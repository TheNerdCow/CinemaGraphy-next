/**
 * Node runtime — Core + Stremio adapter + providers.
 * CinemaGraphy-next 0.6.5 — static brand assets + clean landing
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import { loadEnvFile } from './load-env.js'
import { configFromEnv, decodeUserConfig, encodeUserConfig, applyMode } from '../../core/config/app-config.js'
import { createLogger } from '../../core/logging/logger.js'
import { buildStremioManifest } from '../../clients/stremio/manifest.js'
import { registerProvider, listEnabledProviders, getProvider } from '../../providers/registry.js'
import { stubExampleProvider } from '../../providers/stub-example.js'
import { createF2MediaProvider } from '../../providers/f2media/index.js'
import { createCinamaticProvider } from '../../providers/cinamatic/index.js'
import { createAslMoviezProvider } from '../../providers/aslmoviez/index.js'
import { createAvaMovieProvider } from '../../providers/avamovie/index.js'
import { createDigiMovieProvider } from '../../providers/digimovie/index.js'
import { fromStremioProviderId, toStremioProviderId } from '../../core/ids/namespace.js'
import { setSessionCookie, getSessionCookie, hasSessionCookie } from './session-store.js'
import { bootNetwork } from './boot-net.js'
import { renderLanding } from './landing.js'

bootNetwork()
loadEnvFile('.env')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const log = createLogger(process.env.LOG_LEVEL || 'info')
const PORT = Number(process.env.PORT) || 7000
const VERSION = process.env.ADDON_VERSION || '0.6.5'

const FREE_PROVIDERS = ['f2media', 'cinamatic', 'aslmoviez']
const ALL_PROVIDER_KEYS = [...FREE_PROVIDERS, 'avamovie', 'digimovie']

registerProvider(stubExampleProvider)
registerProvider(createF2MediaProvider({ logger: log }))
registerProvider(createCinamaticProvider({ logger: log }))
registerProvider(createAslMoviezProvider({ logger: log }))
registerProvider(createAvaMovieProvider({ logger: log }))
registerProvider(createDigiMovieProvider({ logger: log }))

function deepMergeProviders(a = {}, b = {}) {
  const out = { ...a }
  for (const [k, v] of Object.entries(b || {})) out[k] = { ...(out[k] || {}), ...(v || {}) }
  return out
}

function resolveConfig(req) {
  const server = configFromEnv(process.env)
  const token = req.params?.config || req.query?.config
  const overlay = token ? decodeUserConfig(token) : null
  let cfg = server
  if (overlay) {
    cfg = applyMode({
      ...server,
      ...overlay,
      resources: { ...server.resources, ...(overlay.resources || {}) },
      meta: { ...server.meta, ...(overlay.meta || {}) },
      ui: { ...server.ui, ...(overlay.ui || {}) },
      providers: deepMergeProviders(server.providers, overlay.providers),
      providersEnabled: overlay.providersEnabled?.length
        ? overlay.providersEnabled
        : server.providersEnabled,
    })
  }
  if (!cfg.providers?.avamovie?.cookie) {
    const c = getSessionCookie('avamovie')
    if (c) cfg = { ...cfg, providers: deepMergeProviders(cfg.providers, { avamovie: { cookie: c, enabled: true } }) }
  }
  if (!cfg.providers?.digimovie?.cookie) {
    const c = getSessionCookie('digimovie')
    if (c) cfg = { ...cfg, providers: deepMergeProviders(cfg.providers, { digimovie: { cookie: c, enabled: true } }) }
  }
  return cfg
}

function buildPersonalConfig({ providersEnabled, avaCookie, digiCookie, avaBaseUrl, digiBaseUrl }) {
  const enabled = (providersEnabled || []).filter((k) => ALL_PROVIDER_KEYS.includes(k))
  const unique = [...new Set(enabled.length ? enabled : FREE_PROVIDERS)]
  const providers = {}
  const ava = String(avaCookie || '').trim()
  const digi = String(digiCookie || '').trim()
  const avaBase = String(avaBaseUrl || '').trim()
  const digiBase = String(digiBaseUrl || '').trim()
  if (unique.includes('avamovie')) {
    if (!ava) unique.splice(unique.indexOf('avamovie'), 1)
    else {
      providers.avamovie = { cookie: ava.slice(0, 4096), enabled: true }
      if (avaBase.startsWith('http')) providers.avamovie.baseUrl = avaBase.replace(/\/+$/, '').slice(0, 200)
    }
  }
  if (unique.includes('digimovie')) {
    if (!digi) unique.splice(unique.indexOf('digimovie'), 1)
    else {
      providers.digimovie = { cookie: digi.slice(0, 4096), enabled: true }
      if (digiBase.startsWith('http')) providers.digimovie.baseUrl = digiBase.replace(/\/+$/, '').slice(0, 200)
    }
  }
  return { providersEnabled: unique, providers: Object.keys(providers).length ? providers : undefined }
}

function landingHtml(opts = {}) {
  return renderLanding({
    version: VERSION,
    freeProviders: FREE_PROVIDERS,
    selected: opts.selected || FREE_PROVIDERS,
    flash: opts.flash || null,
    personalPath: opts.personalPath || '',
    cookieValue: opts.cookieValue || '',
    digiCookieValue: opts.digiCookieValue || '',
    avaBaseUrl: opts.avaBaseUrl || '',
    digiBaseUrl: opts.digiBaseUrl || '',
  })
}

function toMetas(items, providerKey) {
  return (items || []).map((it) => {
    const itemId = String(it.internalId || '').replace(new RegExp('^cg:' + providerKey + ':'), '')
    return {
      id: toStremioProviderId(providerKey, itemId),
      type: it.type,
      name: it.title,
      poster: it.poster,
      releaseInfo: it.year ? String(it.year) : undefined,
    }
  })
}

function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.urlencoded({ extended: true }))
  app.use(express.json({ limit: '64kb' }))

  // Brand assets (logo, bg, fav, mark) — static files in assets/
  app.use('/assets', express.static(path.join(__dirname, 'assets'), {
    maxAge: '7d',
    fallthrough: true,
  }))

  app.get('/', (_req, res) => res.type('html').send(landingHtml()))
  app.get('/configure', (_req, res) => res.type('html').send(landingHtml()))

  app.post('/configure', (req, res) => {
    const body = req.body || {}
    let providers = body.providers
    if (!providers) providers = []
    if (!Array.isArray(providers)) providers = [providers]
    providers = providers.map(String).filter((k) => ALL_PROVIDER_KEYS.includes(k))
    const cookie = String(body.avaCookie || '').trim()
    const digiCookie = String(body.digiCookie || '').trim()
    const avaBase = String(body.avaBaseUrl || '').trim()
    const digiBase = String(body.digiBaseUrl || '').trim()

    if (!providers.length) providers = [...FREE_PROVIDERS]
    if (providers.includes('avamovie') && !cookie) {
      return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'آوا تیک خورده ولی کوکی خالی است' }, selected: providers, digiCookieValue: digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase }))
    }
    if (providers.includes('digimovie') && !digiCookie) {
      return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'دیجی تیک خورده ولی کوکی خالی است' }, selected: providers, cookieValue: cookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase }))
    }

    const cfg = buildPersonalConfig({ providersEnabled: providers, avaCookie: cookie, digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase })
    const token = encodeUserConfig(cfg)
    if (!token) return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'ساخت کانفیگ ناموفق بود' }, selected: providers }))

    if (cookie) setSessionCookie('avamovie', cookie)
    if (digiCookie) setSessionCookie('digimovie', digiCookie)

    const host = req.get('x-forwarded-host') || req.get('host') || ('localhost:' + PORT)
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim()
    const personalPath = proto + '://' + host + '/c/' + token + '/manifest.json'
    return res.type('html').send(landingHtml({
      flash: { ok: true, msg: 'مانیفست شخصی آماده است — نصب کن یا لینک را کپی کن' },
      personalPath,
      selected: cfg.providersEnabled,
      cookieValue: cookie,
      digiCookieValue: digiCookie,
      avaBaseUrl: avaBase,
      digiBaseUrl: digiBase,
    }))
  })

  app.post('/session/clear', (_req, res) => {
    setSessionCookie('avamovie', '')
    setSessionCookie('digimovie', '')
    res.type('html').send(landingHtml({ flash: { ok: true, msg: 'نشست سرور پاک شد' } }))
  })

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'cinemagraphy-next',
      version: VERSION,
      providers: listEnabledProviders(configFromEnv(process.env)).map((p) => p.key),
    })
  })

  function manifestHandler(req, res) {
    try {
      const cfg = resolveConfig(req)
      const providers = listEnabledProviders(cfg).map((p) => ({
        key: p.key,
        name: p.name,
        capabilities: p.capabilities,
      }))
      res.json(buildStremioManifest(cfg, providers))
    } catch (err) {
      log.error('manifest', err)
      res.status(500).json({ error: String(err.message || err) })
    }
  }

  async function catalogHandler(req, res) {
    try {
      const cfg = resolveConfig(req)
      const type = req.params.type
      let id = String(req.params.id || '')
      if (id.endsWith('.json')) id = id.slice(0, -5)
      const extraArgs = req.params.extraArgs || ''
      const extra = {}
      if (extraArgs) {
        const raw = extraArgs.endsWith('.json') ? extraArgs.slice(0, -5) : extraArgs
        for (const part of raw.split('&')) {
          const eq = part.indexOf('=')
          if (eq < 0) continue
          const k = decodeURIComponent(part.slice(0, eq))
          const v = decodeURIComponent(part.slice(eq + 1) || '')
          if (k) extra[k] = v
        }
      }
      const search = extra.search ? String(extra.search) : ''
      const genreRaw = extra.genre ? String(extra.genre) : ''
      const genre = genreRaw && !/^all$/i.test(genreRaw) ? genreRaw : ''
      const skip = extra.skip ? Number(extra.skip) : 0

      const typeCatalog = id.match(/^([a-z0-9]+)_(movies|series)$/i)
      if (typeCatalog) {
        const providerKey = typeCatalog[1].toLowerCase()
        const provider = getProvider(providerKey)
        if (!provider || (typeof provider.isEnabled === 'function' && !provider.isEnabled(cfg))) {
          return res.json({ metas: [] })
        }
        const wantType = type === 'series' ? 'series' : 'movie'
        let items = []
        if (search && provider.search) {
          items = await provider.search(search, { config: cfg, skip, timeoutMs: 18000 })
          items = (items || []).filter((it) => (it.type || wantType) === wantType)
        } else if (genre && provider.browseGenre) {
          items = await provider.browseGenre(wantType, genre, { config: cfg, skip, timeoutMs: 18000 })
        } else if (provider.browseType) {
          items = await provider.browseType(wantType, { config: cfg, skip, timeoutMs: 18000 })
        }
        return res.json({ metas: toMetas(items, providerKey) })
      }

      let providerKey = null
      for (const k of ['cinamatic', 'aslmoviez', 'avamovie', 'digimovie', 'f2media']) {
        if (id.startsWith(k + '_')) {
          providerKey = k
          break
        }
      }
      if (providerKey) {
        const provider = getProvider(providerKey)
        if (!provider || (typeof provider.isEnabled === 'function' && !provider.isEnabled(cfg))) {
          return res.json({ metas: [] })
        }
        let items = []
        const wantType = type === 'series' ? 'series' : 'movie'
        if (search && provider.search) {
          items = await provider.search(search, { config: cfg, skip, timeoutMs: 22000 })
          items = (items || []).filter((it) => (it.type || wantType) === wantType)
        } else if (genre && provider.browseGenre) {
          items = await provider.browseGenre(wantType, genre, {
            config: cfg,
            skip,
            timeoutMs: 22000,
          })
        } else if (provider.browse) {
          items = await provider.browse(id, { config: cfg, skip, timeoutMs: 22000 })
        } else if (provider.browseType) {
          items = await provider.browseType(wantType, {
            config: cfg,
            skip,
            timeoutMs: 22000,
          })
        }
        return res.json({ metas: toMetas(items, providerKey) })
      }
      res.json({ metas: [] })
    } catch (err) {
      log.error('catalog', err)
      res.json({ metas: [] })
    }
  }

  async function metaHandler(req, res) {
    try {
      const cfg = resolveConfig(req)
      let id = String(req.params.id || '')
      if (id.endsWith('.json')) id = id.slice(0, -5)
      const parsed = fromStremioProviderId(id)
      if (!parsed) return res.json({ meta: null })
      const provider = getProvider(parsed.providerKey)
      if (!provider || !provider.getDetail || (typeof provider.isEnabled === 'function' && !provider.isEnabled(cfg))) {
        return res.json({ meta: null })
      }
      const detail = await provider.getDetail(parsed.itemId, req.params.type, { config: cfg })
      if (!detail) return res.json({ meta: null })
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
      }
      if (detail.type === 'series' && detail.videos && detail.videos.length) {
        meta.videos = detail.videos.map((v) => ({
          id: metaId + ':' + v.season + ':' + v.episode,
          title: v.title || ('S' + v.season + 'E' + v.episode),
          season: v.season,
          episode: v.episode,
        }))
      }
      res.json({ meta })
    } catch (err) {
      log.error('meta', err)
      res.json({ meta: null })
    }
  }

  async function streamHandler(req, res) {
    try {
      const cfg = resolveConfig(req)
      let id = String(req.params.id || '')
      if (id.endsWith('.json')) id = id.slice(0, -5)
      const parsed = fromStremioProviderId(id)
      if (!parsed) return res.json({ streams: [] })
      const provider = getProvider(parsed.providerKey)
      if (!provider || !provider.getDetail || (typeof provider.isEnabled === 'function' && !provider.isEnabled(cfg))) {
        return res.json({ streams: [] })
      }
      const detail = await provider.getDetail(parsed.itemId, req.params.type, { config: cfg })
      if (!detail) return res.json({ streams: [] })
      const streams = await provider.getStreams(detail, {
        season: parsed.season,
        episode: parsed.episode,
      })
      res.json({
        streams: (streams || []).map((s) => ({
          name: s.name || s.quality || 'HD',
          title: s.title,
          url: s.url,
        })),
      })
    } catch (err) {
      log.error('stream', err)
      res.json({ streams: [] })
    }
  }

  for (const prefix of ['', '/c/:config']) {
    app.get(prefix + '/manifest.json', manifestHandler)
    app.get(prefix + '/catalog/:type/:id/:extraArgs.json', catalogHandler)
    app.get(prefix + '/catalog/:type/:id/:extraArgs', catalogHandler)
    app.get(prefix + '/catalog/:type/:id.json', catalogHandler)
    app.get(prefix + '/catalog/:type/:id', catalogHandler)
    app.get(prefix + '/meta/:type/:id.json', metaHandler)
    app.get(prefix + '/stream/:type/:id.json', streamHandler)
  }

  return app
}

const app = createApp()
app.listen(PORT, () => log.info('cinemagraphy-next listening', { port: PORT, version: VERSION }))
export { createApp, resolveConfig }
