/**
 * Node runtime — Core + Stremio adapter + providers.
 * CinemaGraphy-next 0.6.6 — Mode Switching (Full / Stream-Only) + Cinamatic cookie
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
const log = createLogger(process.env.LOG_LEVEL ?? 'info')
const PORT = Number(process.env.PORT) || 7000
const VERSION = process.env.ADDON_VERSION ?? '0.6.6'

const FREE_PROVIDERS = ['f2media', 'cinamatic', 'aslmoviez']
const ALL_PROVIDER_KEYS = [...FREE_PROVIDERS, 'avamovie', 'digimovie']

registerProvider(stubExampleProvider)
registerProvider(createF2MediaProvider({ logger: log }))
registerProvider(createCinamaticProvider({ logger: log }))
registerProvider(createAslMoviezProvider({ logger: log }))
registerProvider(createAvaMovieProvider({ logger: log }))
registerProvider(createDigiMovieProvider({ logger: log }))

const memCache = new Map()
const CACHE_TTL = {
  catalog: 2 * 60 * 60 * 1000,
  meta: 12 * 60 * 60 * 1000,
  stream: 20 * 60 * 1000,
}

async function getSafeCache(key, ttl, fn) {
  const now = Date.now()
  const hit = memCache.get(key)
  if (hit && hit.exp > now) return hit.val
  const val = await fn()
  const isNotEmpty = Array.isArray(val) ? val.length > 0 : Boolean(val)
  if (isNotEmpty) memCache.set(key, { val, exp: now + ttl })
  return val
}

function normalizeTitle(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[''`:!?,._\-()[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function resolveImdbMeta(imdbId, type) {
  const cleanType = type === 'series' ? 'series' : 'movie'
  return getSafeCache(`imdb_meta:${cleanType}:${imdbId}`, CACHE_TTL.meta, async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 7000)
    try {
      const url = `https://v3-cinemeta.strem.io/meta/${cleanType}/${imdbId}.json`
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) return null
      const data = await res.json()
      if (!data?.meta?.name) return null
      const yearRaw = data.meta.releaseInfo ?? data.meta.year ?? ''
      const yearMatch = String(yearRaw).match(/\d{4}/)
      return {
        name: data.meta.name,
        year: yearMatch ? Number(yearMatch[0]) : null,
      }
    } catch {
      clearTimeout(timer)
      return null
    }
  })
}

function pickBestProviderItem(items, targetName, targetYear, wantType) {
  if (!Array.isArray(items) || !items.length) return null
  const normTarget = normalizeTitle(targetName)
  const typed = items.filter((it) => !it.type || it.type === wantType)
  const pool = typed.length ? typed : items
  let best = null
  let bestScore = -1
  for (const it of pool) {
    const rawTitle = String(it.title ?? '')
    const normTitle = normalizeTitle(rawTitle)
    let score = 0
    if (normTitle === normTarget) score += 100
    else if (normTitle.includes(normTarget)) score += 65
    else {
      const words = normTarget.split(' ').filter((w) => w.length > 2)
      const matched = words.filter((w) => normTitle.includes(w)).length
      if (words.length) score += (matched / words.length) * 50
    }
    if (targetYear && it.year) {
      const diff = Math.abs(Number(it.year) - Number(targetYear))
      if (diff === 0) score += 35
      else if (diff === 1) score += 15
      else if (diff > 2) score -= 25
    }
    if (score > bestScore) {
      bestScore = score
      best = it
    }
  }
  return bestScore >= 35 ? best : pool[0]
}

async function fetchExternalStreamsForImdb(rawId, type, cfg) {
  const parts = String(rawId).split(':')
  const imdbId = parts[0]
  const season = parts[1] ? Number(parts[1]) : undefined
  const episode = parts[2] ? Number(parts[2]) : undefined
  const wantType = type === 'series' ? 'series' : 'movie'
  const imdbMeta = await resolveImdbMeta(imdbId, wantType)
  if (!imdbMeta || !imdbMeta.name) return []
  const enabledProviders = listEnabledProviders(cfg)
  const providerPromises = enabledProviders.map(async (provider) => {
    try {
      if (!provider.search || !provider.getDetail || !provider.getStreams) return []
      const isSub = provider.key === 'digimovie' || provider.key === 'avamovie' || provider.key === 'cinamatic'
      if (isSub) {
        const cookie = cfg.providers?.[provider.key]?.cookie
        if (!cookie) {
          log.warn?.('external-stream skip (no cookie)', { provider: provider.key })
          return []
        }
      }
      const searchResults = await provider.search(imdbMeta.name, {
        config: cfg,
        skip: 0,
        timeoutMs: isSub ? 22000 : 14000,
      })
      const bestMatch = pickBestProviderItem(searchResults, imdbMeta.name, imdbMeta.year, wantType)
      if (!bestMatch) return []
      const itemId = String(bestMatch.internalId ?? '').replace(new RegExp('^cg:' + provider.key + ':'), '')
      if (!itemId) return []
      const detail = await provider.getDetail(itemId, wantType, { config: cfg })
      if (!detail) return []
      const rawStreams = await provider.getStreams(detail, { season, episode })
      const pLabel = provider.name ?? provider.key.toUpperCase()
      return (rawStreams ?? []).map((s) => ({
        name: `[${pLabel}] ${s.name ?? s.quality ?? 'HD'}`,
        title: s.title ?? detail.title ?? imdbMeta.name,
        url: s.url,
      }))
    } catch (err) {
      log.error(`external-stream-${provider.key}`, err)
      return []
    }
  })
  const nested = await Promise.all(providerPromises)
  return nested.flat()
}

function deepMergeProviders(a = {}, b = {}) {
  const out = { ...a }
  for (const [k, v] of Object.entries(b ?? {})) {
    out[k] = { ...(out[k] ?? {}), ...(v ?? {}) }
  }
  return out
}

function extractTokenAndMode(rawParam) {
  const raw = String(rawParam ?? '')
  const match = raw.match(/^m-(full|streams_only)~(.*)$/)
  if (match) return { addonMode: match[1], cleanToken: match[2] }
  return { addonMode: 'full', cleanToken: raw }
}

function resolveConfig(req) {
  const server = configFromEnv(process.env)
  const rawToken = req.params?.config ?? req.query?.config ?? ''
  const { addonMode, cleanToken } = extractTokenAndMode(rawToken)
  const overlay = cleanToken ? decodeUserConfig(cleanToken) : null
  let cfg = server
  if (overlay) {
    cfg = applyMode({
      ...server,
      ...overlay,
      resources: { ...server.resources, ...(overlay.resources ?? {}) },
      meta: { ...server.meta, ...(overlay.meta ?? {}) },
      ui: { ...server.ui, ...(overlay.ui ?? {}) },
      providers: deepMergeProviders(server.providers, overlay.providers),
      providersEnabled: overlay.providersEnabled?.length
        ? overlay.providersEnabled
        : server.providersEnabled,
    })
  }
  const avaSess = getSessionCookie('avamovie')
  if (avaSess) {
    cfg = { ...cfg, providers: deepMergeProviders(cfg.providers, { avamovie: { cookie: avaSess, enabled: true } }) }
  }
  const digiSess = getSessionCookie('digimovie')
  if (digiSess) {
    cfg = { ...cfg, providers: deepMergeProviders(cfg.providers, { digimovie: { cookie: digiSess, enabled: true } }) }
  }
  const cinaSess = getSessionCookie('cinamatic')
  if (cinaSess) {
    cfg = { ...cfg, providers: deepMergeProviders(cfg.providers, { cinamatic: { cookie: cinaSess, enabled: true } }) }
  }
  cfg.addonMode = addonMode === 'streams_only' ? 'streams_only' : 'full'
  return cfg
}

function buildPersonalConfig({ providersEnabled, avaCookie, digiCookie, cinaCookie, avaBaseUrl, digiBaseUrl, cinaBaseUrl }) {
  const enabled = (providersEnabled ?? []).filter((k) => ALL_PROVIDER_KEYS.includes(k))
  const unique = [...new Set(enabled.length ? enabled : FREE_PROVIDERS)]
  const providers = {}
  const ava = String(avaCookie ?? '').trim()
  const digi = String(digiCookie ?? '').trim()
  const cina = String(cinaCookie ?? '').trim()
  const avaBase = String(avaBaseUrl ?? '').trim()
  const digiBase = String(digiBaseUrl ?? '').trim()
  const cinaBase = String(cinaBaseUrl ?? '').trim()
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
  if (unique.includes('cinamatic') && cina) {
    providers.cinamatic = { cookie: cina.slice(0, 4096), enabled: true }
    if (cinaBase.startsWith('http')) providers.cinamatic.baseUrl = cinaBase.replace(/\/+$/, '').slice(0, 200)
  }
  return {
    providersEnabled: unique,
    providers: Object.keys(providers).length ? providers : undefined,
  }
}

function landingHtml(opts = {}, req = null) {
  let hostManifest = '/manifest.json'
  if (req) {
    const host = req.get('x-forwarded-host') ?? req.get('host') ?? ('localhost:' + PORT)
    const protoRaw = req.get('x-forwarded-proto') ?? req.protocol ?? 'http'
    const proto = String(protoRaw).split(',')[0].trim()
    hostManifest = proto + '://' + host + '/manifest.json'
  }
  return renderLanding({
    version: VERSION,
    freeProviders: FREE_PROVIDERS,
    selected: opts.selected ?? FREE_PROVIDERS,
    addonMode: opts.addonMode ?? 'full',
    flash: opts.flash ?? null,
    personalPath: opts.personalPath ?? '',
    cookieValue: opts.cookieValue ?? '',
    digiCookieValue: opts.digiCookieValue ?? '',
    cinaCookieValue: opts.cinaCookieValue ?? '',
    avaBaseUrl: opts.avaBaseUrl ?? '',
    digiBaseUrl: opts.digiBaseUrl ?? '',
    cinaBaseUrl: opts.cinaBaseUrl ?? '',
    hostManifest,
  })
}

function toMetas(items, providerKey) {
  return (items ?? []).map((it) => {
    const itemId = String(it.internalId ?? '').replace(new RegExp('^cg:' + providerKey + ':'), '')
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
    await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    clearTimeout(timeout)
    return true
  } catch {
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
      f2media: cfg.providers?.f2media?.baseUrl ?? 'https://www.myf2ms.top',
      cinamatic: cfg.providers?.cinamatic?.baseUrl ?? 'https://cinamatic.top',
      aslmoviez: cfg.providers?.aslmoviez?.baseUrl ?? 'https://aslmoviez.com',
      avamovie: cfg.providers?.avamovie?.baseUrl ?? 'https://avadel.top',
      digimovie: cfg.providers?.digimovie?.baseUrl ?? 'https://digimoviez53.top',
    }
    const entries = await Promise.all(
      Object.entries(domains).map(async ([k, u]) => [k, await checkDomainReachable(u)])
    )
    const result = Object.fromEntries(entries)
    statusCache = { ts: now, data: result }
    res.json(result)
  })

  app.post('/configure', (req, res) => {
    const body = req.body ?? {}
    let providers = body.providers
    if (!providers) providers = []
    if (!Array.isArray(providers)) providers = [providers]
    providers = providers.map(String).filter((k) => ALL_PROVIDER_KEYS.includes(k))
    const cookie = String(body.avaCookie ?? '').trim()
    const digiCookie = String(body.digiCookie ?? '').trim()
    const cinaCookie = String(body.cinaCookie ?? '').trim()
    const avaBase = String(body.avaBaseUrl ?? '').trim()
    const digiBase = String(body.digiBaseUrl ?? '').trim()
    const cinaBase = String(body.cinaBaseUrl ?? '').trim()
    const addonMode = body.addonMode === 'streams_only' ? 'streams_only' : 'full'

    if (!providers.length) providers = [...FREE_PROVIDERS]
    if (providers.includes('avamovie') && !cookie) {
      return res.type('html').send(landingHtml({
        flash: { ok: false, msg: 'آوا تیک خورده ولی کوکی خالی است' },
        selected: providers, addonMode, digiCookieValue: digiCookie, cinaCookieValue: cinaCookie,
        avaBaseUrl: avaBase, digiBaseUrl: digiBase, cinaBaseUrl: cinaBase,
      }, req))
    }
    if (providers.includes('digimovie') && !digiCookie) {
      return res.type('html').send(landingHtml({
        flash: { ok: false, msg: 'دیجی تیک خورده ولی کوکی خالی است' },
        selected: providers, addonMode, cookieValue: cookie, cinaCookieValue: cinaCookie,
        avaBaseUrl: avaBase, digiBaseUrl: digiBase, cinaBaseUrl: cinaBase,
      }, req))
    }
    if (providers.includes('cinamatic') && !cinaCookie) {
      return res.type('html').send(landingHtml({
        flash: { ok: false, msg: 'سینماتیک تیک خورده ولی کوکی خالی است — اشتراک لازم است' },
        selected: providers, addonMode, cookieValue: cookie, digiCookieValue: digiCookie,
        avaBaseUrl: avaBase, digiBaseUrl: digiBase, cinaBaseUrl: cinaBase,
      }, req))
    }

    const cfg = buildPersonalConfig({
      providersEnabled: providers, avaCookie: cookie, digiCookie, cinaCookie,
      avaBaseUrl: avaBase, digiBaseUrl: digiBase, cinaBaseUrl: cinaBase,
    })
    const baseToken = encodeUserConfig(cfg)
    if (!baseToken) {
      return res.type('html').send(landingHtml({
        flash: { ok: false, msg: 'ساخت کانفیگ ناموفق بود' }, selected: providers, addonMode,
      }, req))
    }

    const finalToken = addonMode === 'full' ? baseToken : `m-${addonMode}~${baseToken}`

    if (cookie) setSessionCookie('avamovie', cookie)
    if (digiCookie) setSessionCookie('digimovie', digiCookie)
    if (cinaCookie) setSessionCookie('cinamatic', cinaCookie)

    const host = req.get('x-forwarded-host') ?? req.get('host') ?? ('localhost:' + PORT)
    const protoRaw = req.get('x-forwarded-proto') ?? req.protocol ?? 'http'
    const proto = String(protoRaw).split(',')[0].trim()
    const personalPath = proto + '://' + host + '/c/' + finalToken + '/manifest.json'

    return res.type('html').send(landingHtml({
      flash: { ok: true, msg: 'مانیفست شخصی آماده است — نصب کن یا لینک را کپی کن' },
      personalPath,
      selected: cfg.providersEnabled,
      addonMode,
      cookieValue: cookie,
      digiCookieValue: digiCookie,
      cinaCookieValue: cinaCookie,
      avaBaseUrl: avaBase,
      digiBaseUrl: digiBase,
      cinaBaseUrl: cinaBase,
    }, req))
  })

  app.post('/session/clear', (req, res) => {
    setSessionCookie('avamovie', '')
    setSessionCookie('digimovie', '')
    setSessionCookie('cinamatic', '')
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
      const addonMode = cfg.addonMode ?? 'full'
      const providers = listEnabledProviders(cfg).map((p) => ({
        key: p.key,
        name: p.name,
        capabilities: p.capabilities,
      }))
      const manifest = buildStremioManifest(cfg, providers)

      if (!Array.isArray(manifest.idPrefixes)) manifest.idPrefixes = ['cg:']
      if (!manifest.idPrefixes.includes('tt')) manifest.idPrefixes.push('tt')

      if (addonMode === 'streams_only') {
        manifest.id = `${manifest.id}.streams`
        manifest.name = `${manifest.name} [فقط منابع]`
        manifest.catalogs = []
        manifest.resources = [
          { name: 'stream', types: ['movie', 'series'], idPrefixes: ['tt', 'cg:'] },
        ]
      }

      const host = req.get('x-forwarded-host') ?? req.get('host') ?? ('localhost:' + PORT)
      const protoRaw = req.get('x-forwarded-proto') ?? req.protocol ?? 'http'
      const proto = String(protoRaw).split(',')[0].trim()
      manifest.logo = `${proto}://${host}/assets/favandinstall.png`
      manifest.icon = manifest.logo
      manifest.version = VERSION
      res.json(manifest)
    } catch (err) {
      log.error('manifest', err)
      res.status(500).json({ error: String(err.message ?? err) })
    }
  }

  async function catalogHandler(req, res) {
    try {
      const cfg = resolveConfig(req)
      if (cfg.addonMode === 'streams_only') return res.json({ metas: [] })

      const type = req.params.type
      let id = String(req.params.id ?? '')
      if (id.endsWith('.json')) id = id.slice(0, -5)
      const extraArgs = req.params.extraArgs ?? ''
      const extra = {}
      if (extraArgs) {
        const raw = extraArgs.endsWith('.json') ? extraArgs.slice(0, -5) : extraArgs
        for (const part of raw.split('&')) {
          const eq = part.indexOf('=')
          if (eq < 0) continue
          const k = decodeURIComponent(part.slice(0, eq))
          const v = decodeURIComponent(part.slice(eq + 1) ?? '')
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
        const cacheKey = `tc:${providerKey}:${wantType}:${search}:${genre}:${skip}`
        const metas = await getSafeCache(cacheKey, CACHE_TTL.catalog, async () => {
          let items = []
          if (search && provider.search) {
            items = await provider.search(search, { config: cfg, skip, timeoutMs: 18000 })
            items = (items ?? []).filter((it) => (it.type ?? wantType) === wantType)
          } else if (genre && provider.browseGenre) {
            items = await provider.browseGenre(wantType, genre, { config: cfg, skip, timeoutMs: 18000 })
          } else if (provider.browseType) {
            items = await provider.browseType(wantType, { config: cfg, skip, timeoutMs: 18000 })
          }
          return toMetas(items, providerKey)
        })
        return res.json({ metas: metas ?? [] })
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
        const wantType = type === 'series' ? 'series' : 'movie'
        const cacheKey = `cat:${providerKey}:${id}:${wantType}:${search}:${genre}:${skip}`
        const metas = await getSafeCache(cacheKey, CACHE_TTL.catalog, async () => {
          let items = []
          if (search && provider.search) {
            items = await provider.search(search, { config: cfg, skip, timeoutMs: 22000 })
            items = (items ?? []).filter((it) => (it.type ?? wantType) === wantType)
          } else if (genre && provider.browseGenre) {
            items = await provider.browseGenre(wantType, genre, { config: cfg, skip, timeoutMs: 22000 })
          } else if (provider.browse) {
            items = await provider.browse(id, { config: cfg, skip, timeoutMs: 22000 })
          } else if (provider.browseType) {
            items = await provider.browseType(wantType, { config: cfg, skip, timeoutMs: 22000 })
          }
          return toMetas(items, providerKey)
        })
        return res.json({ metas: metas ?? [] })
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
      let id = String(req.params.id ?? '')
      if (id.endsWith('.json')) id = id.slice(0, -5)
      const parsed = fromStremioProviderId(id)
      if (!parsed) return res.json({ meta: null })
      const provider = getProvider(parsed.providerKey)
      if (!provider || !provider.getDetail || (typeof provider.isEnabled === 'function' && !provider.isEnabled(cfg))) {
        return res.json({ meta: null })
      }
      const cacheKey = `meta:${parsed.providerKey}:${parsed.itemId}:${req.params.type}`
      const meta = await getSafeCache(cacheKey, CACHE_TTL.meta, async () => {
        const detail = await provider.getDetail(parsed.itemId, req.params.type, { config: cfg })
        if (!detail) return null
        const metaId = toStremioProviderId(parsed.providerKey, parsed.itemId)
        const m = {
          id: metaId,
          type: detail.type ?? req.params.type,
          name: detail.title ?? id,
          poster: detail.poster,
          background: detail.background ?? detail.poster,
          description: detail.description,
          releaseInfo: detail.year ? String(detail.year) : undefined,
          genres: detail.genres,
          imdbRating: detail.imdbRating,
        }
        if (detail.type === 'series' && detail.videos && detail.videos.length) {
          m.videos = detail.videos.map((v) => ({
            id: metaId + ':' + v.season + ':' + v.episode,
            title: v.title ?? ('S' + v.season + 'E' + v.episode),
            season: v.season,
            episode: v.episode,
          }))
        }
        return m
      })
      res.json({ meta: meta ?? null })
    } catch (err) {
      log.error('meta', err)
      res.json({ meta: null })
    }
  }

  async function streamHandler(req, res) {
    try {
      const cfg = resolveConfig(req)
      let id = String(req.params.id ?? '')
      if (id.endsWith('.json')) id = id.slice(0, -5)

      if (id.startsWith('tt')) {
        const enabledKeys = listEnabledProviders(cfg).map((p) => p.key).join(',')
        const cacheKey = `ext_stream:${req.params.type}:${id}:${enabledKeys}`
        const streams = await getSafeCache(cacheKey, CACHE_TTL.stream, () =>
          fetchExternalStreamsForImdb(id, req.params.type, cfg)
        )
        return res.json({ streams: streams ?? [] })
      }

      const parsed = fromStremioProviderId(id)
      if (!parsed) return res.json({ streams: [] })
      const provider = getProvider(parsed.providerKey)
      if (!provider || !provider.getDetail || (typeof provider.isEnabled === 'function' && !provider.isEnabled(cfg))) {
        return res.json({ streams: [] })
      }
      const sNum = parsed.season ?? 0
      const eNum = parsed.episode ?? 0
      const cacheKey = `stream:${parsed.providerKey}:${parsed.itemId}:${req.params.type}:${sNum}:${eNum}`
      const streams = await getSafeCache(cacheKey, CACHE_TTL.stream, async () => {
        const detail = await provider.getDetail(parsed.itemId, req.params.type, { config: cfg })
        if (!detail) return []
        const rawStreams = await provider.getStreams(detail, {
          season: parsed.season,
          episode: parsed.episode,
        })
        return (rawStreams ?? []).map((s) => ({
          name: s.name ?? s.quality ?? 'HD',
          title: s.title,
          url: s.url,
        }))
      })
      res.json({ streams: streams ?? [] })
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
