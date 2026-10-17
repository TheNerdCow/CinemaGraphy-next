/**
 * Node runtime — Core + Stremio adapter + providers.
 */

import cors from 'cors'
import express from 'express'
import { loadEnvFile } from './load-env.js'
import { configFromEnv, decodeUserConfig, applyMode } from '../../core/config/app-config.js'
import { createLogger } from '../../core/logging/logger.js'
import { buildStremioManifest } from '../../clients/stremio/manifest.js'
import { registerProvider, listEnabledProviders, getProvider } from '../../providers/registry.js'
import { stubExampleProvider } from '../../providers/stub-example.js'
import { createF2MediaProvider } from '../../providers/f2media/index.js'
import { createCinamaticProvider } from '../../providers/cinamatic/index.js'
import { createAslMoviezProvider } from '../../providers/aslmoviez/index.js'
import { fromStremioProviderId, toStremioProviderId } from '../../core/ids/namespace.js'
import { createHttpClient } from '../../core/http/client.js'
import { parseListingHtml } from '../../providers/f2media/parse-listing.js'

loadEnvFile('.env')

const log = createLogger(process.env.LOG_LEVEL || 'info')
const PORT = Number(process.env.PORT) || 7000
const VERSION = process.env.ADDON_VERSION || '0.4.1'

registerProvider(stubExampleProvider)
registerProvider(createF2MediaProvider({ logger: log }))
registerProvider(createCinamaticProvider({ logger: log }))
registerProvider(createAslMoviezProvider({ logger: log }))

function resolveConfig(req) {
  const server = configFromEnv(process.env)
  const token = req.params?.config || req.query?.config
  const overlay = token ? decodeUserConfig(token) : null
  if (!overlay) return server
  return applyMode({
    ...server,
    ...overlay,
    resources: { ...server.resources, ...(overlay.resources || {}) },
    meta: { ...server.meta, ...(overlay.meta || {}) },
    ui: { ...server.ui, ...(overlay.ui || {}) },
  })
}

function parseExtra(raw) {
  if (!raw) return {}
  try {
    const s = String(raw).replace(/\.json$/i, '')
    return Object.fromEntries(new URLSearchParams(s))
  } catch {
    return {}
  }
}

function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '32kb' }))

  const sendManifest = (req, res) => {
    const config = resolveConfig(req)
    const providers = listEnabledProviders(config).map((p) => ({
      key: p.key,
      name: p.name,
      capabilities: p.capabilities,
    }))
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.json(buildStremioManifest(config, providers))
  }

  app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"/>
<title>CinemaGraphy Next</title>
<style>body{font-family:system-ui;background:#0b0d12;color:#e8eaef;padding:2rem}
a{color:#6ea8ff}.card{max-width:40rem;margin:auto;background:#12161f;border-radius:12px;padding:1.5rem;border:1px solid #243044}</style></head>
<body><div class="card"><h1>سینماگرافی Next ${VERSION}</h1>
<p>F2Media + Cinamatic + AslMoviez</p>
<ul><li><a href="/manifest.json">manifest</a></li><li><a href="/health">health</a></li>
<li><a href="/debug/f2">debug f2</a></li></ul></div></body></html>`)
  })

  app.get('/health', (_req, res) => {
    const config = configFromEnv(process.env)
    res.json({
      ok: true,
      service: 'cinemagraphy-next',
      version: VERSION,
      providers: listEnabledProviders(config).map((p) => p.key),
      time: new Date().toISOString(),
    })
  })

  app.get('/debug/f2', async (_req, res) => {
    const base =
      (process.env.F2MEDIA_BASEURL || 'https://www.myf2ms.top').replace(/\/+$/, '')
    const url = `${base}/movies/`
    const http = createHttpClient({ timeoutMs: 18_000 })
    try {
      const r = await http.get(url)
      const text = r.ok ? await r.text() : ''
      const parsed = text ? parseListingHtml(text, base) : []
      res.json({
        ok: r.ok,
        status: r.status,
        base,
        url,
        htmlLen: text.length,
        parsed: parsed.length,
        sample: parsed.slice(0, 5).map((p) => ({ title: p.title, path: p.pagePath })),
        version: VERSION,
      })
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err.message,
        base,
        url,
        version: VERSION,
      })
    }
  })

  app.get('/manifest.json', sendManifest)
  app.get('/c/:config/manifest.json', sendManifest)

  async function catalogHandler(req, res) {
    const config = resolveConfig(req)
    const type = req.params.type
    let id = String(req.params.id || '').replace(/\.json$/i, '')
    const extraRaw =
      req.params.extraArgs ||
      req.params[0] ||
      (req.url.includes('/search=') ||
      req.url.includes('/skip=') ||
      req.url.includes('/genre=')
        ? req.url.split('/').pop()
        : '')
    const extra = parseExtra(extraRaw)
    const search = extra.search ? String(extra.search) : ''
    const genre = extra.genre ? String(extra.genre) : ''
    const skip = extra.skip ? Number(extra.skip) : 0

    log.info('catalog request', {
      type,
      id,
      search: search || undefined,
      genre: genre || undefined,
      skip,
    })

    const typeCatalog = id.match(/^([a-z0-9]+)_(movies|series)$/i)
    if (typeCatalog) {
      const providerKey = typeCatalog[1].toLowerCase()
      const provider = getProvider(providerKey)
      if (!provider || !provider.isEnabled(config)) {
        res.json({ metas: [] })
        return
      }
      const wantType = type === 'series' ? 'series' : 'movie'
      try {
        let items = []
        if (search && provider.search) {
          items = await provider.search(search, { config, skip, timeoutMs: 18_000 })
        } else if (genre && provider.browseGenre) {
          items = await provider.browseGenre(wantType, genre, {
            config,
            skip,
            timeoutMs: 18_000,
          })
        } else if (provider.browseType) {
          items = await provider.browseType(wantType, {
            config,
            skip,
            timeoutMs: 18_000,
          })
        }
        res.json({ metas: toMetas(items, providerKey, wantType) })
      } catch (err) {
        log.warn('catalog type/search/genre error', { message: err.message })
        res.json({ metas: [] })
      }
      return
    }

    if (
      id.startsWith('f2media_') ||
      id.startsWith('cinamatic_') ||
      id.startsWith('aslmoviez_')
    ) {
      const providerKey = id.startsWith('cinamatic_')
        ? 'cinamatic'
        : id.startsWith('aslmoviez_')
          ? 'aslmoviez'
          : 'f2media'
      const provider = getProvider(providerKey)
      if (!provider || !provider.isEnabled(config) || config.mode === 'streams') {
        res.json({ metas: [] })
        return
      }
      try {
        let items = []
        if (search && provider.search) {
          items = await provider.search(search, { config, skip, timeoutMs: 18_000 })
        } else if (genre && provider.browseGenre) {
          const wantType = type === 'series' ? 'series' : 'movie'
          items = await provider.browseGenre(wantType, genre, {
            config,
            skip,
            timeoutMs: 18_000,
          })
        } else if (provider.browse) {
          items = await provider.browse(id, { config, skip, timeoutMs: 18_000 })
        }
        res.json({ metas: toMetas(items, providerKey, type) })
      } catch (err) {
        log.warn('catalog browse error', { message: err.message })
        res.json({ metas: [] })
      }
      return
    }

    res.json({ metas: [] })
  }

  function toMetas(items, providerKey, wantType) {
    return (items || [])
      .filter(
        (it) =>
          !wantType ||
          it.type === wantType ||
          (wantType === 'movie' && it.type !== 'series'),
      )
      .map((it) => {
        const itemId = String(it.internalId || '').replace(
          new RegExp(`^cg:${providerKey}:`),
          '',
        )
        return {
          id: toStremioProviderId(providerKey, itemId),
          type: it.type,
          name: it.title,
          poster: it.poster,
          releaseInfo: it.year ? String(it.year) : undefined,
        }
      })
  }

  app.get('/catalog/:type/:id/:extraArgs.json', catalogHandler)
  app.get('/catalog/:type/:id/:extraArgs', catalogHandler)
  app.get('/catalog/:type/:id.json', catalogHandler)
  app.get('/catalog/:type/:id', catalogHandler)

  app.get('/meta/:type/:id.json', async (req, res) => {
    const config = resolveConfig(req)
    const id = String(req.params.id || '').replace(/\.json$/i, '')
    const parsed = fromStremioProviderId(id)
    if (!parsed) {
      res.json({ meta: null })
      return
    }
    const provider = getProvider(parsed.providerKey)
    if (!provider?.getDetail || !provider.isEnabled(config)) {
      res.json({ meta: null })
      return
    }
    try {
      const detail = await provider.getDetail(parsed.itemId, req.params.type, { config })
      if (!detail) {
        res.json({ meta: null })
        return
      }
      const metaId = toStremioProviderId(parsed.providerKey, parsed.itemId)
      const meta = {
        id: metaId,
        type: detail.type || req.params.type,
        name: detail.title || id,
        poster: detail.poster,
        background: detail.background || detail.poster,
        description: detail.description,
        releaseInfo: detail.year ? String(detail.year) : undefined,
        genres: detail.genres,
        imdbRating: detail.imdbRating,
        runtime: detail.runtime,
      }
      if (detail.type === 'series' && detail.videos?.length) {
        meta.videos = detail.videos.map((v) => ({
          id: `${metaId}:${v.season}:${v.episode}`,
          title: v.title || `S${v.season}E${v.episode}`,
          season: v.season,
          episode: v.episode,
        }))
      }
      res.json({ meta })
    } catch (err) {
      log.warn('meta error', { message: err.message })
      res.json({ meta: null })
    }
  })

  app.get('/stream/:type/:id.json', async (req, res) => {
    const config = resolveConfig(req)
    const id = String(req.params.id || '').replace(/\.json$/i, '')
    const parsed = fromStremioProviderId(id)
    if (!parsed) {
      res.json({ streams: [] })
      return
    }
    const provider = getProvider(parsed.providerKey)
    if (!provider?.getDetail || !provider.isEnabled(config)) {
      res.json({ streams: [] })
      return
    }
    try {
      const detail = await provider.getDetail(parsed.itemId, req.params.type, { config })
      if (!detail) {
        res.json({ streams: [] })
        return
      }
      const streams = await provider.getStreams(detail, {
        season: parsed.season,
        episode: parsed.episode,
      })
      log.info('stream response', { id, count: (streams || []).length })
      res.json({
        streams: (streams || []).map((s) => ({
          name: s.name || s.quality || 'HD',
          title: s.title,
          url: s.url,
        })),
      })
    } catch (err) {
      log.warn('stream error', { message: err.message })
      res.json({ streams: [] })
    }
  })

  return app
}

const app = createApp()
app.listen(PORT, () => {
  log.info('cinemagraphy-next listening', { port: PORT, version: VERSION })
})

export { createApp, resolveConfig }
