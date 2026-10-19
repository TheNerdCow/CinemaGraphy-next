/**
 * Node runtime — Core + Stremio adapter + providers.
 * CinemaGraphy-next 0.6.6 — Liquid Glass Edition with Dynamic Catalogs
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
const VERSION = process.env.ADDON_VERSION || '0.6.6'

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
      providersEnabled: overlay.providersEnabled?.length ? overlay.providersEnabled : server.providersEnabled,
      catalogs: overlay.catalogs || {} // اضافه شدن کاتالوگ‌ها
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

function buildPersonalConfig({ providersEnabled, catalogs, avaCookie, digiCookie, avaBaseUrl, digiBaseUrl }) {
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
  return { providersEnabled: unique, providers: Object.keys(providers).length ? providers : undefined, catalogs }
}

function landingHtml(opts = {}, req = null) {
  let hostManifest = '/manifest.json'
  if (req) {
    const host = req.get('x-forwarded-host') || req.get('host') || ('localhost:' + PORT)
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim()
    hostManifest = proto + '://' + host + '/manifest.json'
  }
  return renderLanding({
    version: VERSION,
    freeProviders: FREE_PROVIDERS,
    selected: opts.selected || FREE_PROVIDERS,
    catalogs: opts.catalogs || {},
    flash: opts.flash || null,
    personalPath: opts.personalPath || '',
    cookieValue: opts.cookieValue || '',
    digiCookieValue: opts.digiCookieValue || '',
    avaBaseUrl: opts.avaBaseUrl || '',
    digiBaseUrl: opts.digiBaseUrl || '',
    hostManifest,
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

// وضعیت آنلاین با دور زدن کامل Cloudflare
let statusCache = { ts: 0, data: null }

async function checkDomainReachable(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
    })
    clearTimeout(timeout)
    return true // اگر سایت وصل شد (حتی با ارور 403 کلادفلر)، یعنی سرور بالاست
  } catch (err) {
    clearTimeout(timeout)
    return false
  }
}

function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.urlencoded({ extended: true }))
  app.use(express.json({ limit: '64kb' }))

  app.use('/assets', express.static(path.join(__dirname, 'assets'), {
    maxAge: '7d',
    fallthrough: true,
  }))

  app.get('/', (req, res) => res.type('html').send(landingHtml({}, req)))
  app.get('/configure', (req, res) => res.type('html').send(landingHtml({}, req)))

  app.get('/api/sources-status', async (_req, res) => {
    const now = Date.now()
    if (statusCache.data && now - statusCache.ts < 60_000) {
      return res.json(statusCache.data)
    }
    const cfg = configFromEnv(process.env)
    const domains = {
      f2media: cfg.providers?.f2media?.baseUrl || 'https://www.myf2ms.top',
      cinamatic: cfg.providers?.cinamatic?.baseUrl || 'https://cinamatic.top',
      aslmoviez: cfg.providers?.aslmoviez?.baseUrl || 'https://aslmoviez.com',
      avamovie: cfg.providers?.avamovie?.baseUrl || 'https://avadel.top',
      digimovie: cfg.providers?.digimovie?.baseUrl || 'https://digimoviez53.top',
    }
    const entries = await Promise.all(
      Object.entries(domains).map(async ([k, u]) => [k, await checkDomainReachable(u)])
    )
    const result = Object.fromEntries(entries)
    statusCache = { ts: now, data: result }
    res.json(result)
  })

  app.post('/configure', (req, res) => {
    const body = req.body || {}
    let providers = body.providers
    if (!providers) providers = []
    if (!Array.isArray(providers)) providers = [providers]
    providers = providers.map(String).filter((k) => ALL_PROVIDER_KEYS.includes(k))
    
    // خواندن کاتالوگ‌های انتخاب شده
    const catalogs = {
      f2media: [].concat(body.f2media_cat || []),
      cinamatic: [].concat(body.cinamatic_cat || []),
      aslmoviez: [].concat(body.aslmoviez_cat || []),
      avamovie: [].concat(body.avamovie_cat || []),
      digimovie: [].concat(body.digimovie_cat || []),
    }

    const cookie = String(body.avaCookie || '').trim()
    const digiCookie = String(body.digiCookie || '').trim()
    const avaBase = String(body.avaBaseUrl || 'https://avadel.top').trim()
    const digiBase = String(body.digiBaseUrl || 'https://digimoviez53.top').trim()

    if (!providers.length) providers = [...FREE_PROVIDERS]
    if (providers.includes('avamovie') && !cookie) {
      return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'آوا تیک خورده ولی کوکی خالی است' }, selected: providers, catalogs, digiCookieValue: digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase }, req))
    }
    if (providers.includes('digimovie') && !digiCookie) {
      return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'دیجی تیک خورده ولی کوکی خالی است' }, selected: providers, catalogs, cookieValue: cookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase }, req))
    }

    const cfg = buildPersonalConfig({ providersEnabled: providers, catalogs, avaCookie: cookie, digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase })
    const token = encodeUserConfig(cfg)
    if (!token) return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'ساخت کانفیگ ناموفق بود' }, selected: providers, catalogs }, req))

    if (cookie) setSessionCookie('avamovie', cookie)
    if (digiCookie) setSessionCookie('digimovie', digiCookie)

    const host = req.get('x-forwarded-host') || req.get('host') || ('localhost:' + PORT)
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim()
    const personalPath = proto + '://' + host + '/c/' + token + '/manifest.json'
    return res.type('html').send(landingHtml({
      flash: { ok: true, msg: 'مانیفست شخصی آماده است — نصب کن یا لینک را کپی کن' },
      personalPath,
      selected: cfg.providersEnabled,
      catalogs: cfg.catalogs,
      cookieValue: cookie,
      digiCookieValue: digiCookie,
      avaBaseUrl: avaBase,
      digiBaseUrl: digiBase,
    }, req))
  })

  app.post('/session/clear', (req, res) => {
    setSessionCookie('avamovie', '')
    setSessionCookie('digimovie', '')
    res.type('html').send(landingHtml({ flash: { ok: true, msg: 'نشست سرور پاک شد' } }, req))
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
      
      const manifest = buildStremioManifest(cfg, providers)
      
      // اتصال منطق کاتالوگ‌های لندینگ به مانیفست استریمیو
      if (cfg.catalogs && manifest.catalogs) {
        manifest.catalogs = manifest.catalogs.filter(cat => {
          let provKey = null
          for (const k of ALL_PROVIDER_KEYS) {
            if (cat.id.toLowerCase().includes(k)) provKey = k
          }
          if (provKey && cfg.catalogs[provKey]) {
            const allowed = cfg.catalogs[provKey]
            const cid = cat.id.toLowerCase()
            const isDubbed = cid.includes('dubbed') || (cat.name && cat.name.includes('دوبله'))
            
            if (isDubbed && !allowed.includes('dubbed')) return false
            if (cid.includes('series') && !allowed.includes('series')) return false
            if (cid.includes('movie') && !isDubbed && !allowed.includes('movies')) return false
          }
          return true
        })
      }
      
      // آپدیت لوگوی افزونه به فایل جدید
      manifest.logo = manifest.logo.replace('MainLogo.jpg', 'favandinstall.png')
      manifest.icon = manifest.icon ? manifest.icon.replace('MainLogo.jpg', 'favandinstall.png') : manifest.logo
      
      res.json(manifest)
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
          items = await provider.browseGenre(wantType, genre, { config: cfg, skip, timeoutMs: 22000 })
        } else if (provider.browse) {
          items = await provider.browse(id, { config: cfg, skip, timeoutMs: 22000 })
        } else if (provider.browseType) {
          items = await provider.browseType(wantType, { config: cfg, skip, timeoutMs: 22000 })
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