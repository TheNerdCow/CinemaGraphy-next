/**
 * CinemaGraphy NEXT — Native Cloudflare Workers Runtime (Ultimate Catalog Fix)
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getCookie, setCookie } from 'hono/cookie'

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
import { createZardFilmProvider } from './src/providers/zardfilm/index.js'
import { fromStremioProviderId, toStremioProviderId } from './src/core/ids/namespace.js'
import { renderLanding } from './src/runtimes/node/landing.js'
import { ASSET_BG, ASSET_MARK, ASSET_DIGI_FAV } from './src/runtimes/node/landing-assets.js'

const log = createLogger('info')
const VERSION = '0.6.6'

const FREE_PROVIDERS = ['f2media', 'aslmoviez', 'zardfilm']
const ALL_PROVIDER_KEYS = ['f2media', 'aslmoviez', 'zardfilm', 'cinamatic', 'avamovie', 'digimovie']

registerProvider(stubExampleProvider)
registerProvider(createF2MediaProvider({ logger: log }))
registerProvider(createCinamaticProvider({ logger: log }))
registerProvider(createAslMoviezProvider({ logger: log }))
registerProvider(createZardFilmProvider({ logger: log }))
registerProvider(createAvaMovieProvider({ logger: log }))
registerProvider(createDigiMovieProvider({ logger: log }))

function deepMergeProviders(a = {}, b = {}) {
  const out = { ...a }
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = { ...(out[k] || {}), ...(v || {}) }
  }
  return out
}

function safeEncodeConfig(cfg) {
  try {
    const t = encodeUserConfig(cfg)
    if (t) return t
  } catch {}
  try {
    const json = JSON.stringify(cfg)
    const bytes = new TextEncoder().encode(json)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  } catch {
    return null
  }
}

function safeDecodeConfig(token) {
  if (!token) return null
  try {
    const d = decodeUserConfig(token)
    if (d) return d
  } catch {}
  try {
    let b64 = String(token).replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

function getBaseServerConfig(c) {
  const env = c?.env || {}
  const base = configFromEnv(env) || {}
  const defaultProviders = {
    f2media: { enabled: true, baseUrl: 'https://www.myf2ms.top' },
    cinamatic: { enabled: true, baseUrl: 'https://cinamatic.top' },
    aslmoviez: { enabled: true, baseUrl: 'https://aslmoviez.com' },
    avamovie: { enabled: false, baseUrl: 'https://avadel.top' },
    digimovie: { enabled: false, baseUrl: 'https://digimoviez53.top' },
  }
  const merged = deepMergeProviders(defaultProviders, base.providers || {})
  return applyMode({
    ...base,
    mode: base.mode || 'public',
    resources: { catalog: true, meta: true, stream: true, ...(base.resources || {}) },
    providersEnabled: base.providersEnabled?.length ? base.providersEnabled : [...FREE_PROVIDERS],
    providers: merged,
  })
}

function resolveConfig(c) {
  const server = getBaseServerConfig(c)
  const token = c.req.param('config') || c.req.query('config')
  const overlay = token ? safeDecodeConfig(token) : null
  let cfg = server
  if (overlay) {
    const enabledList = overlay.providersEnabled?.length ? overlay.providersEnabled : server.providersEnabled
    const mergedProviders = deepMergeProviders(server.providers, overlay.providers)
    for (const k of ALL_PROVIDER_KEYS) {
      mergedProviders[k] = { ...(mergedProviders[k] || {}), enabled: enabledList.includes(k) }
    }
    cfg = applyMode({
      ...server,
      ...overlay,
      resources: { catalog: true, meta: true, stream: true, ...(server.resources || {}), ...(overlay.resources || {}) },
      meta: { ...(server.meta || {}), ...(overlay.meta || {}) },
      ui: { ...(server.ui || {}), ...(overlay.ui || {}) },
      providers: mergedProviders,
      providersEnabled: enabledList,
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

function getPublicOrigin(c) {
  const url = new URL(c.req.url)
  const proto = (c.req.header('x-forwarded-proto') || url.protocol.replace(':', '') || 'https').split(',')[0].trim()
  const host = c.req.header('x-forwarded-host') || c.req.header('host') || url.host
  return `${proto}://${host}`
}

function landingHtml(opts = {}, c) {
  const hostManifest = `${getPublicOrigin(c)}/manifest.json`
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
    const rawId = String(it.internalId || it.id || '')
    const itemId = rawId.replace(new RegExp('^cg:' + providerKey + ':'), '')
    return {
      id: toStremioProviderId(providerKey, itemId),
      type: it.type || 'movie',
      name: it.title || it.name || 'بدون عنوان',
      poster: it.poster,
      releaseInfo: it.year ? String(it.year) : undefined,
    }
  })
}

function detectProviderKeyFromCatalogId(id) {
  const lower = String(id || '').toLowerCase()
  for (const k of ALL_PROVIDER_KEYS) {
    if (lower.startsWith(k + '_') || lower.startsWith(k + '-') || lower.includes(k)) {
      return k
    }
  }
  return null
}

let statusCache = { ts: 0, data: null }
async function checkDomainReachable(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } })
    clearTimeout(timeout)
    return true
  } catch {
    clearTimeout(timeout)
    return false
  }
}

const app = new Hono()
app.use('*', cors())

app.get('/assets/:file', (c) => {
  const f = c.req.param('file')
  if (f === 'Bg.jpg') return c.redirect(ASSET_BG, 302)
  if (f === 'cropped-digi-fav-32x32.png') return c.redirect(ASSET_DIGI_FAV, 302)
  return c.redirect(ASSET_MARK, 302)
})

app.get('/', (c) => c.html(landingHtml({}, c)))
app.get('/configure', (c) => c.html(landingHtml({}, c)))
app.get('/c/:config/configure', (c) => c.html(landingHtml({}, c)))

app.get('/api/sources-status', async (c) => {
  const now = Date.now()
  if (statusCache.data && now - statusCache.ts < 60_000) return c.json(statusCache.data)
  const cfg = getBaseServerConfig(c)
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
  const body = await c.req.parseBody({ all: true })
  let providers = body['providers'] || body['providers[]']
  if (!providers) providers = []
  if (!Array.isArray(providers)) providers = [providers]
  providers = providers.map(String).filter((k) => ALL_PROVIDER_KEYS.includes(k))

  const cookie = String(body.avaCookie || '').trim()
  const digiCookie = String(body.digiCookie || '').trim()
  const avaBase = String(body.avaBaseUrl || '').trim()
  const digiBase = String(body.digiBaseUrl || '').trim()

  if (!providers.length) providers = [...FREE_PROVIDERS]
  if (providers.includes('avamovie') && !cookie) {
    return c.html(landingHtml({ flash: { ok: false, msg: 'آوا تیک خورده ولی کوکی خالی است' }, selected: providers, digiCookieValue: digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase }, c))
  }
  if (providers.includes('digimovie') && !digiCookie) {
    return c.html(landingHtml({ flash: { ok: false, msg: 'دیجی تیک خورده ولی کوکی خالی است' }, selected: providers, cookieValue: cookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase }, c))
  }

  const cfg = buildPersonalConfig({ providersEnabled: providers, avaCookie: cookie, digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase })
  const token = safeEncodeConfig(cfg)
  if (!token) {
    return c.html(landingHtml({ flash: { ok: false, msg: 'ساخت کانفیگ ناموفق بود' }, selected: providers }, c))
  }

  if (cookie) setCookie(c, 'avamovie', cookie, { path: '/', maxAge: 604800 })
  if (digiCookie) setCookie(c, 'digimovie', digiCookie, { path: '/', maxAge: 604800 })

  const personalPath = `${getPublicOrigin(c)}/c/${token}/manifest.json`
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
  setCookie(c, 'avamovie', '', { path: '/', maxAge: 0 })
  setCookie(c, 'digimovie', '', { path: '/', maxAge: 0 })
  return c.html(landingHtml({ flash: { ok: true, msg: 'نشست سرور پاک شد' } }, c))
})

app.get('/health', (c) => {
  const cfg = resolveConfig(c)
  return c.json({
    ok: true,
    service: 'cinemagraphy-next',
    version: VERSION,
    providers: listEnabledProviders(cfg).map((p) => p.key),
  })
})

const manifestHandler = (c) => {
  try {
    const cfg = resolveConfig(c)
    const enabledKeys = cfg.providersEnabled?.length ? cfg.providersEnabled : FREE_PROVIDERS
    let enabled = listEnabledProviders(cfg)
    if (!enabled.length) {
      enabled = enabledKeys.map((k) => getProvider(k)).filter(Boolean)
    }
    const providers = enabled.map((p) => ({
      key: p.key,
      name: p.name,
      capabilities: p.capabilities,
    }))
    const manifest = buildStremioManifest(cfg, providers)

    // اصلاح کامل انواع کاتالوگ‌ها و پاکسازی extraRequired برای نمایش تضمینی در صفحه اصلی استریمیو
    manifest.types = ['movie', 'series', 'tv', 'anime']
    if (Array.isArray(manifest.catalogs)) {
      manifest.catalogs = manifest.catalogs.map((cat) => {
        const cleanedExtra = [{ name: 'search', isRequired: false }, { name: 'skip', isRequired: false }, { name: 'genre', isRequired: false }]
        const out = {
          ...cat,
          extra: cleanedExtra,
        }
        delete out.extraRequired
        return out
      })
    }

    manifest.logo = ASSET_MARK
    manifest.icon = ASSET_MARK
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
    let id = String(c.req.param('id') || '')
    if (id.endsWith('.json')) id = id.slice(0, -5)

    const extraArgs = c.req.param('extraArgs') || ''
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

    const providerKey = detectProviderKeyFromCatalogId(id)
    if (!providerKey) return c.json({ metas: [] })

    const provider = getProvider(providerKey)
    if (!provider) return c.json({ metas: [] })

    const wantType = type === 'series' ? 'series' : 'movie'
    let items = []

    if (search && provider.search) {
      items = await provider.search(search, { config: cfg, skip, timeoutMs: 22000 })
      items = (items || []).filter((it) => (it.type || wantType) === wantType)
    } else if (genre && provider.browseGenre) {
      items = await provider.browseGenre(wantType, genre, { config: cfg, skip, timeoutMs: 22000 })
    } else if (provider.browse) {
      items = await provider.browse(id, { config: cfg, skip, timeoutMs: 22000 })
      if (!items || !items.length) {
        items = await provider.browse(providerKey + '_movies', { config: cfg, skip, timeoutMs: 22000 })
      }
      if ((!items || !items.length) && provider.browseType) {
        items = await provider.browseType(wantType, { config: cfg, skip, timeoutMs: 22000 })
      }
    } else if (provider.browseType) {
      items = await provider.browseType(wantType, { config: cfg, skip, timeoutMs: 22000 })
    }

    return c.json({ metas: toMetas(items, providerKey) })
  } catch (err) {
    log.error('catalog', err)
    return c.json({ metas: [] })
  }
}

const metaHandler = async (c) => {
  try {
    const cfg = resolveConfig(c)
    let id = String(c.req.param('id') || '')
    if (id.endsWith('.json')) id = id.slice(0, -5)
    const parsed = fromStremioProviderId(id)
    if (!parsed) return c.json({ meta: null })
    const provider = getProvider(parsed.providerKey)
    if (!provider || !provider.getDetail) {
      return c.json({ meta: null })
    }
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
      meta.videos = detail.videos.map((v) => ({
        id: metaId + ':' + v.season + ':' + v.episode,
        title: v.title || ('S' + v.season + 'E' + v.episode),
        season: v.season,
        episode: v.episode,
      }))
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
    let id = String(c.req.param('id') || '')
    if (id.endsWith('.json')) id = id.slice(0, -5)
    const parsed = fromStremioProviderId(id)
    if (!parsed) return c.json({ streams: [] })
    const provider = getProvider(parsed.providerKey)
    if (!provider || !provider.getDetail) {
      return c.json({ streams: [] })
    }
    const detail = await provider.getDetail(parsed.itemId, c.req.param('type'), { config: cfg })
    if (!detail) return c.json({ streams: [] })
    const streams = await provider.getStreams(detail, {
      season: parsed.season,
      episode: parsed.episode,
    })
    return c.json({
      streams: (streams || []).map((s) => ({
        name: s.name || s.quality || 'HD',
        title: s.title,
        url: s.url,
      })),
    })
  } catch (err) {
    log.error('stream', err)
    return c.json({ streams: [] })
  }
}

for (const prefix of ['', '/c/:config']) {
  app.get(prefix + '/manifest.json', manifestHandler)
  app.get(prefix + '/catalog/:type/:id/:extraArgs.json', catalogHandler)
  app.get(prefix + '/catalog/:type/:id/:extraArgs', catalogHandler)
  app.get(prefix + '/catalog/:type/:id.json', catalogHandler)
  app.get(prefix + '/catalog/:type/:id', catalogHandler)
  app.get(prefix + '/meta/:type/:id.json', metaHandler)
  app.get(prefix + '/meta/:type/:id', metaHandler)
  app.get(prefix + '/stream/:type/:id.json', streamHandler)
  app.get(prefix + '/stream/:type/:id', streamHandler)
}

export default app