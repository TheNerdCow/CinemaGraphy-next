/**
 * Node runtime — thin Express shell over Core + Stremio adapter.
 */

import cors from 'cors'
import express from 'express'
import { configFromEnv, decodeUserConfig, applyMode, redactSecrets } from '../../core/config/app-config.js'
import { createLogger } from '../../core/logging/logger.js'
import { buildStremioManifest } from '../../clients/stremio/manifest.js'
import { registerProvider, listEnabledProviders } from '../../providers/registry.js'
import { stubExampleProvider } from '../../providers/stub-example.js'

const log = createLogger(process.env.LOG_LEVEL || 'info')
const PORT = Number(process.env.PORT) || 7000

registerProvider(stubExampleProvider)

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
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>CinemaGraphy Next</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0b0d12;color:#e8eaef;margin:0;padding:2rem;line-height:1.6}
    a{color:#6ea8ff} code{background:#1a1f2b;padding:.15rem .4rem;border-radius:4px}
    .card{max-width:40rem;margin:auto;background:#12161f;border:1px solid #243044;border-radius:12px;padding:1.5rem}
  </style>
</head>
<body>
  <div class="card">
    <h1>سینماگرافی Next</h1>
    <p>بازنویسی مستقل و ماژولار — scaffold. production روی <code>cmplugin.ir</code> دست نخورده است.</p>
    <ul>
      <li><a href="/manifest.json">manifest.json</a></li>
      <li><a href="/health">health</a></li>
      <li><a href="https://github.com/TheNerdCow/CinemaGraphy-next">GitHub</a></li>
    </ul>
  </div>
</body>
</html>`)
  })

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'cinemagraphy-next',
      version: process.env.ADDON_VERSION || '0.1.0',
      time: new Date().toISOString(),
    })
  })

  app.get('/manifest.json', sendManifest)
  app.get('/c/:config/manifest.json', sendManifest)

  app.get('/catalog/:type/:id/:extraArgs.json', (_req, res) => {
    res.json({ metas: [] })
  })
  app.get('/catalog/:type/:id.json', (_req, res) => {
    res.json({ metas: [] })
  })
  app.get('/meta/:type/:id.json', (_req, res) => {
    res.json({ meta: null })
  })
  app.get('/stream/:type/:id.json', (_req, res) => {
    res.json({ streams: [] })
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
