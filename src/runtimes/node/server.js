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
import { fromStremioProviderId, toStremioProviderId } from '../../core/ids/namespace.js'

loadEnvFile('.env')

const log = createLogger(process.env.LOG_LEVEL || 'info')
const PORT = Number(process.env.PORT) || 7000
const VERSION = process.env.ADDON_VERSION || '0.2.0'

registerProvider(stubExampleProvider)
registerProvider(createF2MediaProvider({ logger: log }))

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
    const manifest = buildStremioManifest(config, providers)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=30')
    res.json(manifest)
  }

  app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>CinemaGraphy Next</title>
<style>body{font-family:system-ui,sans-serif;background:#0b0d12;color:#e8eaef;margin:0;padding:2rem;line-height:1.6}
a{color:#6ea8ff}code{background:#1a1f2b;padding:.15rem .4rem;border-radius:4px}
.card{max-width:42rem;margin:auto;background:#12161f;border:1px solid #243044;border-radius:12px;padding:1.5rem}</style></head>
<body><div class="card"><h1>سینماگرافی Next ${VERSION}</h1>
<p>F2Media browse catalogs + search/stream.</p>
<ul>
<li><a href="/manifest.json">manifest</a></li>
<li><a href="/health">health</a></li>
<li><a href="/catalog/movie/f2media_movies_updated.json">کاتالوگ فیلم‌های به‌روز</a></li>
</ul></div></body></html>`)
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

  app.get('/manifest.json', sendManifest)
  app.get('/c/:config/manifest.json', sendManifest)

  async function catalogHandler(req, res) {
    const config = resolveConfig(req)
    const type = req.params.type
    let id = String(req.params.id || '').replace(/\.json$/i, '')
    const extraRaw =
      req.params.extraArgs ||
      req.params[0] ||
      (req.url.includes('/search=') || req.url.includes('/skip=')
        ? req.url.split('/').pop()
        : '')
    const extra = parseExtra(extraRaw)
    const search = extra.search ? String(extra.search) : ''
    const skip = extra.skip ? Number(extra.skip) : 0

    log.info('catalog request', { type, id, search: search || undefined, skip })

    // Search catalogs: f2media_movies / f2media_series
    const searchMatch = id.match(/^([a-z0-9]+)_(movies|series)$/i)
    if (searchMatch && search) {
      const providerKey = searchMatch[1].toLowerCase()
      const provider = getProvider(providerKey)
      if (!provider?.search || !provider.isEnabled(config)) {
        res.json({ metas: [] })
        return
      }
      try {
        const items = await provider.search(search, {
          config,
          timeoutMs: config.timeouts?.providerMs || 15_000,
        })
        const wantType = type === 'series' ? 'series' : 'movie'
        res.json({ metas: toMetas(items, providerKey, wantType) })
      } catch (err) {
        log.warn('catalog search error', { message: err.message })
        res.json({ metas: [] })
      }
      return
    }

    // Browse catalogs: f2media_movies_updated, f2media_turkish, …
    if (id.startsWith('f2media_') && !search) {
      const provider = getProvider('f2media')
      if (!provider?.browse || !provider.isEnabled(config)) {
        res.json({ metas: [] })
        return
      }
      // streams-only mode: no browse catalogs
      if (config.mode === 'streams') {
        res.json({ metas: [] })
        return
      }
      try {
        const items = await provider.browse(id, {
          config,
          skip,
          timeoutMs: config.timeouts?.providerMs || 15_000,
        })
        res.json({ metas: toMetas(items, 'f2media', type) })
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
    const detail = await provider.getDetail(parsed.itemId, req.params.type, { config })
    if (!detail) {
      res.json({ meta: null })
      return
    }
    res.json({
      meta: {
        id,
        type: detail.type || req.params.type,
        name: detail.title || id,
        poster: detail.poster,
        background: detail.background || detail.poster,
        description: detail.description,
        releaseInfo: detail.year ? String(detail.year) : undefined,
        genres: detail.genres,
        imdbRating: detail.imdbRating,
        runtime: detail.runtime,
      },
    })
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
    const detail = await provider.getDetail(parsed.itemId, req.params.type, { config })
    if (!detail) {
      res.json({ streams: [] })
      return
    }
    const streams = await provider.getStreams(detail, null, { config })
    res.json({
      streams: (streams || []).map((s) => ({
        name: s.name || s.quality || 'HD',
        title: s.title,
        url: s.url,
      })),
    })
  })

  return app
}

const app = createApp()
app.listen(PORT, () => {
  log.info('cinemagraphy-next listening', { port: PORT, version: VERSION })
})

export { createApp, resolveConfig }
