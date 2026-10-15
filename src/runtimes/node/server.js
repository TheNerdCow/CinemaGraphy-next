/**
 * Node runtime — Core + Stremio adapter + providers.
 */

import cors from 'cors'
import express from 'express'
import { configFromEnv, decodeUserConfig, applyMode, redactSecrets } from '../../core/config/app-config.js'
import { createLogger } from '../../core/logging/logger.js'
import { buildStremioManifest } from '../../clients/stremio/manifest.js'
import { registerProvider, listEnabledProviders, getProvider } from '../../providers/registry.js'
import { stubExampleProvider } from '../../providers/stub-example.js'
import { createF2MediaProvider } from '../../providers/f2media/index.js'
import { fromStremioProviderId, toStremioProviderId } from '../../core/ids/namespace.js'

const log = createLogger(process.env.LOG_LEVEL || 'info')
const PORT = Number(process.env.PORT) || 7000

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

function parseExtra(extraArgs) {
  if (!extraArgs) return {}
  try {
    return Object.fromEntries(new URLSearchParams(String(extraArgs).replace(/\.json$/i, '')))
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
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.json(manifest)
  }

  app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>CinemaGraphy Next</title>
<style>body{font-family:system-ui,sans-serif;background:#0b0d12;color:#e8eaef;margin:0;padding:2rem;line-height:1.6}
a{color:#6ea8ff}code{background:#1a1f2b;padding:.15rem .4rem;border-radius:4px}
.card{max-width:40rem;margin:auto;background:#12161f;border:1px solid #243044;border-radius:12px;padding:1.5rem}</style></head>
<body><div class="card"><h1>سینماگرافی Next</h1>
<p>scaffold + F2Media. production روی <code>cmplugin.ir</code> دست نخورده.</p>
<ul><li><a href="/manifest.json">manifest.json</a></li><li><a href="/health">health</a></li>
<li>F2: <code>F2MEDIA_BASEURL</code> در <code>.env</code></li></ul></div></body></html>`)
  })

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'cinemagraphy-next', version: process.env.ADDON_VERSION || '0.1.0', time: new Date().toISOString() })
  })

  app.get('/manifest.json', sendManifest)
  app.get('/c/:config/manifest.json', sendManifest)

  async function catalogHandler(req, res) {
    const config = resolveConfig(req)
    const { type, id } = req.params
    const extra = parseExtra(req.params.extraArgs)
    const search = extra.search ? String(extra.search) : ''

    const m = String(id || '').match(/^([a-z0-9]+)_((movies|series))$/i)
    if (!m || !search) {
      res.json({ metas: [] })
      return
    }
    const providerKey = m[1].toLowerCase()
    const provider = getProvider(providerKey)
    if (!provider || !provider.isEnabled(config)) {
      res.json({ metas: [] })
      return
    }

    try {
      const items = await provider.search(search, { config, timeoutMs: config.timeouts?.providerMs })
      const wantType = type === 'series' ? 'series' : 'movie'
      const metas = items
        .filter((it) => !type || it.type === wantType || (wantType === 'movie' && it.type === 'movie'))
        .map((it) => {
          const itemId = it.internalId?.replace(new RegExp(`^cg:${providerKey}:`), '') || ''
          return {
            id: toStremioProviderId(providerKey, itemId),
            type: it.type,
            name: it.title,
            poster: it.poster,
            releaseInfo: it.year ? String(it.year) : undefined,
          }
        })
      res.json({ metas })
    } catch (err) {
      log.warn('catalog error', { message: err.message })
      res.json({ metas: [] })
    }
  }

  app.get('/catalog/:type/:id/:extraArgs.json', catalogHandler)
  app.get('/catalog/:type/:id.json', catalogHandler)

  app.get('/meta/:type/:id.json', async (req, res) => {
    const config = resolveConfig(req)
    const parsed = fromStremioProviderId(req.params.id)
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
        id: req.params.id,
        type: detail.type || req.params.type,
        name: detail.title || req.params.id,
        releaseInfo: detail.year ? String(detail.year) : undefined,
      },
    })
  })

  app.get('/stream/:type/:id.json', async (req, res) => {
    const config = resolveConfig(req)
    const parsed = fromStremioProviderId(req.params.id)
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
        name: s.quality || 'F2',
        title: s.title,
        url: s.url,
      })),
    })
  })

  app.get('/debug/config', (req, res) => {
    if (process.env.DEV_MODE !== '1') {
      res.status(404).end()
      return
    }
    res.json(redactSecrets(resolveConfig(req)))
  })

  return app
}

const app = createApp()
app.listen(PORT, () => {
  log.info('cinemagraphy-next listening', { port: PORT })
})

export { createApp, resolveConfig }
