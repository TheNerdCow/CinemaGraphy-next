/**
 * Node runtime — Core + Stremio adapter + providers.
 * CinemaGraphy-next 0.6.6 — Liquid Glass Edition (Stable UI)
 * Features: Express Core, Smart Caching, Vercel/Node.js Ready
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
import { setSessionCookie, getSessionCookie } from './session-store.js'
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

// ==========================================
// 🛡️ سیستم کشینگ پیشرفته (برای جلوگیری از لیمیت شدن آی‌پی)
// ==========================================
const memCache = new Map()
const CACHE_TTL = {
  catalog: 4 * 60 * 60 * 1000, // ۴ ساعت برای لیست فیلم‌ها
  meta: 24 * 60 * 60 * 1000,   // ۲۴ ساعت برای توضیحات یک فیلم
  stream: 30 * 60 * 1000       // ۳۰ دقیقه برای لینک‌های پخش
}

async function getCached(key, ttl, fetchFn) {
  const now = Date.now()
  const cached = memCache.get(key)
  if (cached && cached.expire > now) return cached.data
  try {
    const data = await fetchFn()
    if (data !== undefined && data !== null) {
      memCache.set(key, { data, expire: now + ttl })
    }
    return data
  } catch (err) {
    if (cached) return cached.data
    throw err
  }
}

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
      providers: deepMergeProviders(server.providers, overlay.providers),
      providersEnabled: overlay.providersEnabled?.length ? overlay.providersEnabled : server.providersEnabled,
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
  
  for (const k of unique) providers[k] = { enabled: true }

  const ava = String(avaCookie || '').trim()
  const digi = String(digiCookie || '').trim()
  const avaBase = String(avaBaseUrl || '').trim()
  const digiBase = String(digiBaseUrl || '').trim()
  
  if (unique.includes('avamovie')) {
    if (!ava) delete providers.avamovie
    else {
      providers.avamovie.cookie = ava.slice(0, 4096)
      if (avaBase.startsWith('http')) providers.avamovie.baseUrl = avaBase.replace(/\/+$/, '').slice(0, 200)
    }
  }
  if (unique.includes('digimovie')) {
    if (!digi) delete providers.digimovie
    else {
      providers.digimovie.cookie = digi.slice(0, 4096)
      if (digiBase.startsWith('http')) providers.digimovie.baseUrl = digiBase.replace(/\/+$/, '').slice(0, 200)
    }
  }
  return { providersEnabled: Object.keys(providers), providers }
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

let statusCache = { ts: 0, data: null }
async function checkDomainReachable(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    clearTimeout(timeout)
    return true
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
    if (statusCache.data && now - statusCache.ts < 60_000) return res.json(statusCache.data)
    const cfg = configFromEnv(process.env)
    const domains = {
      f2media: cfg.providers?.f2media?.baseUrl || 'https://www.myf2ms.top',
      cinamatic: cfg.providers?.cinamatic?.baseUrl || 'https://cinamatic.top',
      aslmoviez: cfg.providers?.aslmoviez?.baseUrl || 'https://aslmoviez.com',
      avamovie: cfg.providers?.avamovie?.baseUrl || 'https://avadel.top',
      digimovie: cfg.providers?.digimovie?.baseUrl || 'https://digimoviez53.top',
    }
    const entries = await Promise.all(Object.entries(domains).map(async ([k, u]) => [k, await checkDomainReachable(u)]))
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

    const cookie = String(body.avaCookie || '').trim()
    const digiCookie = String(body.digiCookie || '').trim()
    const avaBase = String(body.avaBaseUrl || 'https://avadel.top').trim()
    const digiBase = String(body.digiBaseUrl || 'https://digimoviez53.top').trim()

    if (!providers.length) providers = [...FREE_PROVIDERS]
    if (providers.includes('avamovie') && !cookie) return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'آوا تیک خورده ولی کوکی خالی است' }, selected: providers, digiCookieValue: digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase }, req))
    if (providers.includes('digimovie') && !digiCookie) return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'دیجی تیک خورده ولی کوکی خالی است' }, selected: providers, cookieValue: cookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase }, req))

    const cfg = buildPersonalConfig({ providersEnabled: providers, avaCookie: cookie, digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase })
    const token = encodeUserConfig(cfg)
    if (!token) return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'ساخت کانفیگ ناموفق بود' }, selected: providers }, req))

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
    }, req))
  })

  app.post('/session/clear', (req, res) => {
    setSessionCookie('avamovie', '')
    setSessionCookie('digimovie', '')
    res.type('html').send(landingHtml({ flash: { ok: true, msg: 'نشست سرور پاک شد' } }, req))
  })

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'cinemagraphy-next', version: VERSION }))

  function manifestHandler(req, res) {
    try {
      const cfg = resolveConfig(req)
      const providers = listEnabledProviders(cfg).map((p) => ({ key: p.key, name: p.name, capabilities: p.capabilities }))
      const manifest = buildStremioManifest(cfg, providers)
      
      const host = req.get('x-forwarded-host') || req.get('host') || ('localhost:' + PORT)
      const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim()
      manifest.logo = `${proto}://${host}/assets/favandinstall.png`
      manifest.icon = manifest.logo
      manifest.version = VERSION
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
      let id = String(req.params.id || '').replace('.json', '')
      
      const extraArgs = req.params.extraArgs || ''
      const extra = {}
      if (extraArgs) {
        const raw = extraArgs.replace('.json', '')
        for (const part of raw.split('&')) {
          const eq = part.indexOf('=')
          if (eq < 0) continue
          const k = decodeURIComponent(part.slice(0, eq))
          const v = decodeURIComponent(part.slice(eq + 1) || '')
          if (k) extra[k] = v
        }
      }
      const search = extra.search ? String(extra.search) : ''
      const genre = (extra.genre && !/^all$/i.test(extra.genre)) ? String(extra.genre) : ''
      const skip = extra.skip ? Number(extra.skip) : 0

      let providerKey = null
      for (const k of ALL_PROVIDER_KEYS) {
        if (id.startsWith(k + '_') || id.includes(':' + k + ':')) { providerKey = k; break; }
      }
      
      if (providerKey) {
        const provider = getProvider(providerKey)
        if (!provider || (typeof provider.isEnabled === 'function' && !provider.isEnabled(cfg))) return res.json({ metas: [] })
        
        const wantType = type === 'series' ? 'series' : 'movie'
        const cacheKey = `cat_${providerKey}_${wantType}_${id}_${search}_${genre}_${skip}`
        
        const metas = await getCached(cacheKey, CACHE_TTL.catalog, async () => {
          let items = []
          if (search && provider.search) items = await provider.search(search, { config: cfg, skip, timeoutMs: 22000 })
          else if (genre && provider.browseGenre) items = await provider.browseGenre(wantType, genre, { config: cfg, skip, timeoutMs: 22000 })
          else if (provider.browse) items = await provider.browse(id, { config: cfg, skip, timeoutMs: 22000 })
          else if (provider.browseType) items = await provider.browseType(wantType, { config: cfg, skip, timeoutMs: 22000 })
          
          // حل مشکل اصلی باگ کاتالوگ (جلوگیری از کرش کردن استخراجگر)
          const safeItems = Array.isArray(items) ? items : []
          return toMetas(safeItems.filter(it => (it.type || wantType) === wantType), providerKey)
        })
        
        return res.json({ metas: metas || [] })
      }
      res.json({ metas: [] })
    } catch (err) {
      log.error('catalog error', err)
      res.json({ metas: [] })
    }
  }

  async function metaHandler(req, res) {
    try {
      const cfg = resolveConfig(req)
      let id = String(req.params.id || '').replace('.json', '')
      const parsed = fromStremioProviderId(id)
      if (!parsed) return res.json({ meta: null })
      const provider = getProvider(parsed.providerKey)
      if (!provider || !provider.getDetail || (typeof provider.isEnabled === 'function' && !provider.isEnabled(cfg))) return res.json({ meta: null })
      
      const cacheKey = `meta_${parsed.providerKey}_${parsed.itemId}_${req.params.type}`
      
      const metaObj = await getCached(cacheKey, CACHE_TTL.meta, async () => {
        const detail = await provider.getDetail(parsed.itemId, req.params.type, { config: cfg })
        if (!detail) return null
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
          meta.videos = detail.videos.map((v) => ({ id: metaId + ':' + v.season + ':' + v.episode, title: v.title || ('S' + v.season + 'E' + v.episode), season: v.season, episode: v.episode }))
        }
        return meta
      })
      
      res.json({ meta: metaObj })
    } catch (err) {
      log.error('meta error', err)
      res.json({ meta: null })
    }
  }

  async function streamHandler(req, res) {
    try {
      const cfg = resolveConfig(req)
      let id = String(req.params.id || '').replace('.json', '')
      const parsed = fromStremioProviderId(id)
      if (!parsed) return res.json({ streams: [] })
      const provider = getProvider(parsed.providerKey)
      if (!provider || !provider.getDetail || (typeof provider.isEnabled === 'function' && !provider.isEnabled(cfg))) return res.json({ streams: [] })
      
      const cacheKey = `stream_${parsed.providerKey}_${parsed.itemId}_${req.params.type}_${parsed.season || 0}_${parsed.episode || 0}`
      
      const streamsResult = await getCached(cacheKey, CACHE_TTL.stream, async () => {
        const detail = await provider.getDetail(parsed.itemId, req.params.type, { config: cfg })
        if (!detail) return []
        const streams = await provider.getStreams(detail, { season: parsed.season, episode: parsed.episode })
        return (streams || []).map((s) => ({ name: s.name || s.quality || 'HD', title: s.title, url: s.url }))
      })
      
      res.json({ streams: streamsResult || [] })
    } catch (err) {
      log.error('stream error', err)
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
    app.get(prefix + '/c/:config/meta/:type/:id.json', metaHandler)
    app.get(prefix + '/stream/:type/:id.json', streamHandler)
    app.get(prefix + '/c/:config/stream/:type/:id.json', streamHandler)
  }

  return app
}

const app = createApp()
app.listen(PORT, () => log.info('cinemagraphy-next listening', { port: PORT, version: VERSION }))
export { createApp, resolveConfig }