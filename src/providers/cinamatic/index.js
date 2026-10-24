/**
 * Cinamatic provider (cinamatic.top) — independent of F2Media.
 * Page-by-page browse via /category/.../page/N/ (WP page size ≈ 10).
 * Cookie auth for subscription download links (same pattern as Ava/Digi).
 */

import { makeInternalId, toStremioProviderId } from '../../core/ids/namespace.js'
import { createHttpClient } from '../../core/http/client.js'
import { createMemoryCache } from '../../core/cache/memory.js'
import {
  createCinemetaClient,
  metahubPoster,
  metahubBackground,
} from '../../core/meta/cinemeta.js'
import {
  parseListingHtml,
  parseSearchHtml,
  parseDetailMeta,
  parseDetailStreams,
  buildSeriesVideos,
  decodePageId,
} from './parse.js'
import { getCatalogById, toManifestCatalogs, catalogListUrl } from './catalogs.js'

const DEFAULT_BASE = 'https://cinamatic.top'
/** Must match WordPress posts-per-page so skip advances to the next site page. */
const PAGE_SIZE = 10
const CACHE_LIST_MS = 8 * 60_000
const CACHE_EMPTY_MS = 20_000
const CACHE_DETAIL_MS = 10 * 60_000
const CACHE_META_MS = 30 * 60_000

export function createCinamaticProvider(deps = {}) {
  const http = deps.http || createHttpClient({ maxConcurrent: 5, timeoutMs: 18_000 })
  const metaHttp = deps.metaHttp || createHttpClient({ maxConcurrent: 4, timeoutMs: 6_000 })
  const logger = deps.logger || console
  const cinemeta = deps.cinemeta || createCinemetaClient({ http: metaHttp })
  const cache = deps.cache || createMemoryCache(CACHE_LIST_MS)

  function cookieOf(config) {
    const fromConfig = config?.providers?.cinamatic?.cookie
    const fromEnv = process.env.CINAMATIC_COOKIE
    return String(fromConfig || fromEnv || '').trim()
  }

  function authHeaders(config) {
    const cookie = cookieOf(config)
    if (!cookie) return {}
    const base = (config?.providers?.cinamatic?.baseUrl || process.env.CINAMATIC_BASEURL || DEFAULT_BASE).replace(/\/+$/, '')
    return {
      Cookie: cookie,
      Referer: base + '/',
      Origin: base,
    }
  }

  async function lookupImages(title, year, type) {
    if (!title) return {}
    const key = `cina-meta:${type}:${title}:${year || ''}`
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const out = {}
    try {
      const t = type === 'series' ? 'series' : 'movie'
      const q = year ? `${title} ${year}` : title
      const found = await withTimeout(cinemeta.search(q, t), 4500)
      if (found?.imdb) {
        out.poster = metahubPoster(found.imdb) || found.poster
        out.background = metahubBackground(found.imdb) || found.background || out.poster
        out.imdb = found.imdb
        out.description = found.description
        out.genres = found.genres
        out.imdbRating = found.imdbRating
      }
    } catch {
      /* optional */
    }
    cache.set(key, out, CACHE_META_MS)
    return out
  }

  async function enrichMissing(items, limit = 12) {
    const need = items.filter((i) => !i.poster).slice(0, limit)
    await Promise.all(
      need.map(async (it) => {
        try {
          const img = await lookupImages(it.title, it.year, it.type)
          if (img.poster) it.poster = img.poster
          if (img.imdb) it.imdb = img.imdb
        } catch {
          /* keep */
        }
      }),
    )
    return items
  }

  return {
    key: 'cinamatic',
    name: 'Cinamatic',
    capabilities: {
      search: true,
      browseCatalogs: toManifestCatalogs(),
      streams: true,
      providerMeta: true,
      auth: 'cookie',  // subscription — download links need account cookie
    },

    isEnabled(config) {
      const p = config.providers?.cinamatic
      if (p?.enabled === false) return false
      // Off on the public manifest. Personal install must tick it.
      if (config.providersEnabled?.length) {
        return config.providersEnabled.includes('cinamatic')
      }
      return false
    },

    baseUrl(config) {
      const fromConfig = config.providers?.cinamatic?.baseUrl
      const fromEnv = process.env.CINAMATIC_BASEURL
      const raw = (fromConfig || fromEnv || DEFAULT_BASE).trim()
      return raw.replace(/\/+$/, '') || DEFAULT_BASE
    },

    async search(query, ctx = {}) {
      const q = String(query || '').trim()
      if (!q) return []
      const base = this.baseUrl(ctx.config || {})
      const skip = Number(ctx.skip) || 0
      const page = Math.floor(skip / PAGE_SIZE) + 1
      const cacheKey = `cina-search:${base}:${q.toLowerCase()}:${page}`
      const hit = cache.get(cacheKey)
      if (Array.isArray(hit) && hit.length) return hit

      try {
        const url =
          page <= 1
            ? `${base}/?s=${encodeURIComponent(q)}`
            : `${base}/page/${page}/?s=${encodeURIComponent(q)}`
        const config = ctx.config || {}
        const res = await http.get(url, {
          timeoutMs: ctx.timeoutMs || 18_000,
          headers: authHeaders(config),
        })
        if (!res.ok) {
          logger.warn?.('cinamatic search HTTP', { status: res.status, url })
          return []
        }
        const parsed = parseSearchHtml(await res.text(), base)
        const items = mapItems(parsed)
        await enrichMissing(items, 12)
        cache.set(cacheKey, items, items.length ? CACHE_LIST_MS : CACHE_EMPTY_MS)
        logger.info?.('cinamatic search', { q, page, count: items.length })
        return items
      } catch (err) {
        logger.warn?.('cinamatic search failed', { message: err.message })
        return []
      }
    },

    async browseType(type, ctx = {}) {
      const kind = type === 'series' ? 'series' : 'film'
      const path = kind === 'series' ? '/category/series/' : '/category/film/'
      return this._browsePath(path, kind === 'film' ? 'movie' : 'series', kind, ctx)
    },

    async browse(catalogId, ctx = {}) {
      const cat = getCatalogById(catalogId)
      if (!cat) return []
      return this._browsePath(cat.path, cat.type, cat.kind, ctx, catalogId)
    },

    async _browsePath(path, type, kind, ctx = {}, catalogId = path) {
      const base = this.baseUrl(ctx.config || {})
      const skip = Number(ctx.skip) || 0
      const page = Math.floor(skip / PAGE_SIZE) + 1
      const cacheKey = `cina-browse:${base}:${catalogId}:${page}`
      const hit = cache.get(cacheKey)
      if (Array.isArray(hit) && hit.length) return hit

      try {
        const cat = { path }
        const listUrl = catalogListUrl(base, cat, page)
        const config = ctx.config || {}
        const res = await http.get(listUrl, {
          timeoutMs: ctx.timeoutMs || 18_000,
          headers: authHeaders(config),
        })
        if (!res.ok) {
          logger.warn?.('cinamatic browse HTTP', { status: res.status, listUrl })
          return []
        }
        const html = await res.text()
        let parsed = parseListingHtml(html, base, type, kind)
        parsed = parsed.map((it) => ({ ...it, type: type || it.type }))
        const items = mapItems(parsed)
        await enrichMissing(items, 12)
        cache.set(cacheKey, items, items.length ? CACHE_LIST_MS : CACHE_EMPTY_MS)
        logger.info?.('cinamatic browse', {
          catalogId,
          kind,
          page,
          listUrl,
          count: items.length,
          htmlLen: html.length,
        })
        return items
      } catch (err) {
        logger.warn?.('cinamatic browse failed', { message: err.message, catalogId })
        return []
      }
    },

    async getDetail(itemId, type, ctx = {}) {
      const pagePath = decodePageId(itemId)
      if (!pagePath) return null
      const base = this.baseUrl(ctx.config || {})
      const cacheKey = `cina-detail:${base}:${pagePath}`
      const hit = cache.get(cacheKey)
      if (hit && (hit.streams?.length || hit.videos?.length)) return hit

      try {
        const config = ctx.config || {}
        if (!cookieOf(config)) {
          logger.warn?.('cinamatic detail — no cookie (subscription links may be hidden)')
        }
        const pageUrl = `${base}/${pagePath}`
        const res = await http.get(pageUrl, {
          timeoutMs: ctx.timeoutMs || 18_000,
          headers: authHeaders(config),
        })
        if (!res.ok) {
          logger.warn?.('cinamatic detail HTTP', { status: res.status, pageUrl })
          return null
        }
        const html = await res.text()
        if (/خرید\s*اشتراک|login|عضویت|subscription/i.test(html) && !/\.(mp4|mkv)|cinamadownload/i.test(html)) {
          logger.warn?.('cinamatic detail looks like paywall', { pagePath, htmlLen: html.length })
        }
        const meta = parseDetailMeta(html, base)
        const streams = parseDetailStreams(html, base)

        const isSeries =
          type === 'series' ||
          meta.type === 'series' ||
          streams.some((s) => s.episode != null)

        const episodes = isSeries ? buildSeriesVideos(streams) : []
        const videos = episodes.map((e) => ({
          season: e.season,
          episode: e.episode,
          title: e.title,
        }))

        let img = {}
        try {
          img = await lookupImages(meta.title, meta.year, isSeries ? 'series' : 'movie')
        } catch {
          img = {}
        }

        const imdb = img.imdb
        const poster =
          (imdb && metahubPoster(imdb)) || img.poster || meta.poster || undefined
        const background =
          (imdb && metahubBackground(imdb)) || img.background || poster

        const detail = {
          id: itemId,
          pagePath,
          type: isSeries ? 'series' : 'movie',
          title: meta.title,
          year: meta.year,
          imdb,
          poster,
          background,
          description: img.description || meta.description,
          genres: img.genres,
          imdbRating: img.imdbRating,
          streams,
          episodes,
          videos,
        }

        cache.set(
          cacheKey,
          detail,
          streams.length || videos.length ? CACHE_DETAIL_MS : 60_000,
        )
        logger.info?.('cinamatic detail', {
          pagePath,
          type: detail.type,
          streams: streams.length,
          videos: videos.length,
        })
        return detail
      } catch (err) {
        logger.warn?.('cinamatic detail failed', { message: err.message, itemId })
        return null
      }
    },

    async getStreams(detail, videoCtx = null) {
      if (!detail) return []
      const season = videoCtx?.season
      const episode = videoCtx?.episode

      if (detail.type === 'series' && season != null && episode != null) {
        const ep = (detail.episodes || []).find(
          (e) => Number(e.season) === Number(season) && Number(e.episode) === Number(episode),
        )
        if (ep?.streams?.length) return ep.streams.map(toStream)
        const tagged = (detail.streams || []).filter(
          (s) =>
            Number(s.season || 1) === Number(season) &&
            Number(s.episode) === Number(episode),
        )
        if (tagged.length) return tagged.map(toStream)
        return []
      }

      if (!detail.streams?.length) return []
      if (detail.type === 'series') {
        return detail.streams.filter((s) => !s.episode).map(toStream)
      }
      return detail.streams.map(toStream)
    },

    toClientCatalogId(item) {
      const raw = item.internalId?.replace(/^cg:cinamatic:/, '') || ''
      return toStremioProviderId('cinamatic', raw)
    },
  }
}

function toStream(s) {
  return {
    url: s.url,
    name: s.badge || s.name || 'HD',
    title: s.label || s.title,
    quality: s.quality,
    providerKey: 'cinamatic',
  }
}

function mapItems(parsed) {
  return (parsed || []).map((item) => ({
    internalId: makeInternalId('cinamatic', item.itemId),
    type: item.type,
    title: item.title,
    year: item.year,
    poster: item.poster || undefined,
    providerKey: 'cinamatic',
    externalRefs: { pagePath: item.pagePath },
  }))
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

export default createCinamaticProvider
