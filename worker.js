/**
 * CinemaGraphy NEXT — Cloudflare Workers & Vercel Entry Point
 * 100% Serverless & Native CF Workers Compatible
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getCookie, setCookie } from 'hono/cookie'

// Core & Providers
import { configFromEnv, decodeUserConfig, encodeUserConfig, applyMode } from './src/core/config/app-config.js'
import { createLogger } from './src/core/logging/logger.js'
import { buildStremioManifest } from './src/clients/stremio/manifest.js'
import { registerProvider, listEnabledProviders, getProvider } from './src/providers/registry.js'
import { stubExampleProvider } from './src/providers/stub-example.js'
import { createF2MediaProvider } from './src/providers/f2media/index.js'
import { createCinamaticProvider } from './src/providers/cinamatic/index.js'
import { createAslMoviezProvider } from './src/providers/aslmoviez/index.js'
import { createAvaMovieProvider } from './src/providers/avamovie/index.js'
import { createDigiMovieProvider } from './src/providers/digimovie/index.js'
import { fromStremioProviderId, toStremioProviderId } from './src/core/ids/namespace.js'
import { renderLanding } from './src/runtimes/node/landing.js'

const log = createLogger('info')
const VERSION = '0.6.6'

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

function getEnv(c) { return c.env || {} }

function resolveConfig(c) {
  const env = getEnv(c)
  const server = configFromEnv(env)
  const token = c.req.param('config') || c.req.query('config')
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
    const ck = getCookie(c, 'avamovie')
    if (ck) cfg = { ...cfg, providers: deepMergeProviders(cfg.providers, { avamovie: { cookie: ck, enabled: true } }) }
  }
  if (!cfg.providers?.digimovie?.cookie) {
    const ck = getCookie(c, 'digimovie')
    if (ck) cfg = { ...cfg, providers: deepMergeProviders(cfg.providers, { digimovie: { cookie: ck, enabled: true } }) }
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

function landingHtml(opts = {}, c) {
  const url = new URL(c.req.url)
  const hostManifest = `${url.protocol}//${url.host}/manifest.json`
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
    return { id: toStremioProviderId(providerKey, itemId), type: it.type, name: it.title, poster: it.poster, releaseInfo: it.year ? String(it.year) : undefined }
  })
}

let statusCache = { ts: 0, data: null }
async function checkDomainReachable(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } })
    clearTimeout(timeout)
    return true
  } catch (err) {
    clearTimeout(timeout)
    return false
  }
}

const app = new Hono()
app.use('*', cors())

app.get('/', (c) => c.html(landingHtml({}, c)))
app.get('/configure', (c) => c.html(landingHtml({}, c)))

app.get('/api/sources-status', async (c) => {
  const now = Date.now()
  if (statusCache.data && now - statusCache.ts < 60_000) return c.json(statusCache.data)
  const env = getEnv(c)
  const cfg = configFromEnv(env)
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
  return c.json(result)
})

app.post('/configure', async (c) => {
  const body = await c.req.parseBody()
  let providers = body.providers
  if (!providers) providers = []
  if (!Array.isArray(providers)) providers = [providers]
  providers = providers.map(String).filter((k) => ALL_PROVIDER_KEYS.includes(k))
  
  const cookie = String(body.avaCookie || '').trim()
  const digiCookie = String(body.digiCookie || '').trim()
  const avaBase = String(body.avaBaseUrl || 'https://avadel.top').trim()
  const digiBase = String(body.digiBaseUrl || 'https://digimoviez53.top').trim()

  if (!providers.length) providers = [...FREE_PROVIDERS]
  if (providers.includes('avamovie') && !cookie) return c.html(landingHtml({ flash: { ok: false, msg: 'آوا تیک خورده ولی کوکی خالی است' }, selected: providers, digiCookieValue: digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase }, c))
  if (providers.includes('digimovie') && !digiCookie) return c.html(landingHtml({ flash: { ok: false, msg: 'دیجی تیک خورده ولی کوکی خالی است' }, selected: providers, cookieValue: cookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase }, c))

  const cfg = buildPersonalConfig({ providersEnabled: providers, avaCookie: cookie, digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase })
  const token = encodeUserConfig(cfg)
  if (!token) return c.html(landingHtml({ flash: { ok: false, msg: 'ساخت کانفیگ ناموفق بود' }, selected: providers }, c))

  if (cookie) setCookie(c, 'avamovie', cookie)
  if (digiCookie) setCookie(c, 'digimovie', digiCookie)

  const url = new URL(c.req.url)
  const personalPath = `${url.protocol}//${url.host}/c/${token}/manifest.json`
  return c.html(landingHtml({
    flash: { ok: true, msg: 'مانیفست شخصی آماده است — نصب کن یا لینک را کپی کن' },
    personalPath,
    selected: cfg.providersEnabled,
    cookieValue: cookie,
    digiCookieValue: digiCookie,
    avaBaseUrl: avaBase,
    digiBaseUrl: digiBase,
  }, c))
})

app.post('/session/clear', (c) => {
  setCookie(c, 'avamovie', '', { maxAge: 0 })
  setCookie(c, 'digimovie', '', { maxAge: 0 })
  return c.html(landingHtml({ flash: { ok: true, msg: 'نشست سرور پاک شد' } }, c))
})

app.get('/health', (c) => c.json({ ok: true, service: 'cinemagraphy-next', version: VERSION }))

const manifestHandler = (c) => {
  try {
    const cfg = resolveConfig(c)
    const providers = listEnabledProviders(cfg).map((p) => ({ key: p.key, name: p.name, capabilities: p.capabilities }))
    const manifest = buildStremioManifest(cfg, providers)
    
    // لینک مستقیم لوگو از گیت‌هاب (برای جلوگیری از خطای یافت نشدن عکس در محیط‌های سرورلس)
    manifest.logo = 'https://raw.githubusercontent.com/TheNerdCow/CinemaGraphy-next/main/src/runtimes/node/assets/favandinstall.png'
    manifest.icon = manifest.logo
    manifest.version = VERSION
    return c.json(manifest)
  } catch (err) {
    log.error('manifest', err)
    return c.json({ error: String(err.message || err) }, 500)
  }
}

const catalogHandler = async (c) => {
  try {
    const cfg = resolveConfig(c)
    const type = c.req.param('type')
    let id = String(c.req.param('id') || '').replace('.json', '')
    
    const extraArgs = c.req.param('extraArgs') || ''
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
      if (!provider || (typeof provider.isEnabled === 'function' && !provider.isEnabled(cfg))) return c.json({ metas: [] })
      
      let items = []
      const wantType = type === 'series' ? 'series' : 'movie'
      if (search && provider.search) items = await provider.search(search, { config: cfg, skip, timeoutMs: 22000 })
      else if (genre && provider.browseGenre) items = await provider.browseGenre(wantType, genre, { config: cfg, skip, timeoutMs: 22000 })
      else if (provider.browse) items = await provider.browse(id, { config: cfg, skip, timeoutMs: 22000 })
      else if (provider.browseType) items = await provider.browseType(wantType, { config: cfg, skip, timeoutMs: 22000 })
      
      return c.json({ metas: toMetas(items.filter(it => (it.type || wantType) === wantType), providerKey) })
    }
    return c.json({ metas: [] })
  } catch (err) {
    log.error('catalog', err)
    return c.json({ metas: [] })
  }
}

const metaHandler = async (c) => {
  try {
    const cfg = resolveConfig(c)
    let id = String(c.req.param('id') || '').replace('.json', '')
    const parsed = fromStremioProviderId(id)
    if (!parsed) return c.json({ meta: null })
    const provider = getProvider(parsed.providerKey)
    if (!provider || !provider.getDetail || (typeof provider.isEnabled === 'function' && !provider.isEnabled(cfg))) return c.json({ meta: null })
    
    const detail = await provider.getDetail(parsed.itemId, c.req.param('type'), { config: cfg })
    if (!detail) return c.json({ meta: null })
    const metaId = toStremioProviderId(parsed.providerKey, parsed.itemId)
    const meta = {
      id: metaId,
      type: detail.type || c.req.param('type'),
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
    return c.json({ meta })
  } catch (err) {
    log.error('meta', err)
    return c.json({ meta: null })
  }
}

const streamHandler = async (c) => {
  try {
    const cfg = resolveConfig(c)
    let id = String(c.req.param('id') || '').replace('.json', '')
    const parsed = fromStremioProviderId(id)
    if (!parsed) return c.json({ streams: [] })
    const provider = getProvider(parsed.providerKey)
    if (!provider || !provider.getDetail || (typeof provider.isEnabled === 'function' && !provider.isEnabled(cfg))) return c.json({ streams: [] })
    
    const detail = await provider.getDetail(parsed.itemId, c.req.param('type'), { config: cfg })
    if (!detail) return c.json({ streams: [] })
    const streams = await provider.getStreams(detail, { season: parsed.season, episode: parsed.episode })
    return c.json({ streams: (streams || []).map((s) => ({ name: s.name || s.quality || 'HD', title: s.title, url: s.url })) })
  } catch (err) {
    log.error('stream', err)
    return c.json({ streams: [] })
  }
}

app.get('/manifest.json', manifestHandler)
app.get('/c/:config/manifest.json', manifestHandler)
app.get('/catalog/:type/:id.json', catalogHandler)
app.get('/catalog/:type/:id/:extraArgs', catalogHandler)
app.get('/c/:config/catalog/:type/:id.json', catalogHandler)
app.get('/c/:config/catalog/:type/:id/:extraArgs', catalogHandler)
app.get('/meta/:type/:id.json', metaHandler)
app.get('/c/:config/meta/:type/:id.json', metaHandler)
app.get('/stream/:type/:id.json', streamHandler)
app.get('/c/:config/stream/:type/:id.json', streamHandler)

export default app