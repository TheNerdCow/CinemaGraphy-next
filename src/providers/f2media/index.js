/**
 * F2Media provider — stream-first; Cinemeta/metahub for optional posters (no API key).
 * TMDB is not used on the normal runtime path.
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
  parseSearchHtml,
  parseDetailStreams,
  parseDetailMeta,
  decodePageId,
} from './parse.js'
import { parseListingHtml, parseHomeRail } from './parse-listing.js'
import { parseSeriesEpisodes } from './parse-series.js'
import {
  getCatalogById,
  toManifestCatalogs,
  catalogListUrl,
} from './catalogs.js'

const DEFAULT_BASE = 'https://www.film2med.top'
const PAGE_SIZE = 16
const CACHE_LIST_MS = 8 * 60_000
const CACHE_DETAIL_MS = 10 * 60_000
const CACHE_HTML_MS = 6 * 60_000
const CACHE_META_MS = 30 * 60_000

export function createF2MediaProvider(deps = {}) {
  const http = deps.http || createHttpClient({ maxConcurrent: 6, timeoutMs: 15_000 })
  const metaHttp = deps.metaHttp || createHttpClient({ maxConcurrent: 6, timeoutMs: 6_000 })
  const logger = deps.logger || console
  const cinemeta = deps.cinemeta || createCinemetaClient({ http: metaHttp })
  const cache = deps.cache || createMemoryCache(CACHE_LIST_MS)

  /**
   * Optional images from Cinemeta only. Never renames title. Never throws.
   * Missing meta must not affect streams.
   */
  async function lookupImages(title, year, type) {
    if (!title) return {}
    const key = `meta:${type}:${title}:${year || ''}`
    const cached = cache.get(key)
    if (cached !== undefined) return cached

    const t = type === 'series' ? 'series' : 'movie'
    const out = {}

    try {
      const q = year ? `${title} ${year}` : title
      const found = await withTimeout(cinemeta.search(q, t), 5000)
      if (found?.imdb) {
        out.poster = metahubPoster(found.imdb) || found.poster
        out.background = metahubBackground(found.imdb) || found.background || out.poster
        out.imdb = found.imdb
        out.description = found.description
        out.genres = found.genres
        out.imdbRating = found.imdbRating
      }
    } catch {
      /* metadata optional */
    }

    cache.set(key, out, CACHE_META_MS)
    return out
  }

  async function enrichList(items, limit = 16) {
    const n = Math.min(items.length, limit)
    await Promise.all(
      items.slice(0, n).map(async (it) => {
        try {
          const img = await lookupImages(it.title, it.year, it.type)
          if (img.poster) it.poster = img.poster
          if (img.imdb) it.imdb = img.imdb
        } catch {
          /* keep item without poster */
        }
      }),
    )
    return items
  }

  return {
    key: 'f2media',
    name: 'F2Media',
    capabilities: {
      search: true,
      browseCatalogs: toManifestCatalogs('fa'),
      streams: true,
      providerMeta: true,
      auth: 'none',
    },

    isEnabled(config) {
      const p = config.providers?.f2media
      if (p?.enabled === false) return false
      if (config.providersEnabled?.length) {
        return config.providersEnabled.includes('f2media')
      }
      return true
    },

    baseUrl(config) {
      const fromConfig = config.providers?.f2media?.baseUrl
      const fromEnv = process.env.F2MEDIA_BASEURL
      const raw = (fromConfig || fromEnv || DEFAULT_BASE).trim()
      return raw.replace(/\/+$/, '') || DEFAULT_BASE
    },

    async search(query, ctx = {}) {
      const q = String(query || '').trim()
      if (!q) return []
      const base = this.baseUrl(ctx.config || {})
      const cacheKey = `search:${base}:${q.toLowerCase()}`
      const hit = cache.get(cacheKey)
      if (Array.isArray(hit)) return hit

      try {
        const url = `${base}/?s=${encodeURIComponent(q)}`
        const res = await http.get(url, { timeoutMs: ctx.timeoutMs || 15_000 })
        if (!res.ok) return []
        let parsed = parseSearchHtml(await res.text(), base)

        if (parsed.length === 0) {
          const q2 = q.replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim()
          if (q2 && q2 !== q) {
            const res2 = await http.get(`${base}/?s=${encodeURIComponent(q2)}`, {
              timeoutMs: ctx.timeoutMs || 12_000,
            })
            if (res2.ok) parsed = parseSearchHtml(await res2.text(), base)
          }
        }

        const items = mapItems(parsed)
        // Best-effort posters; list is valid even if enrich fails
        await enrichList(items, 14)
        cache.set(cacheKey, items, CACHE_LIST_MS)
        logger.info?.('f2media search', {
          q,
          count: items.length,
          posters: items.filter((i) => i.poster).length,
        })
        return items
      } catch (err) {
        logger.warn?.('f2media search failed', { message: err.message })
        return []
      }
    },

    async browse(catalogId, ctx = {}) {
      const cat = getCatalogById(catalogId)
      if (!cat) return []
      const base = this.baseUrl(ctx.config || {})
      const skip = Number(ctx.skip) || 0
      const page = Math.floor(skip / PAGE_SIZE) + 1
      const cacheKey = `browse:${base}:${catalogId}:${page}`
      const hit = cache.get(cacheKey)
      if (Array.isArray(hit)) return hit

      try {
        let parsed = []
        const listUrl = catalogListUrl(base, cat, page)
        const listHtml = await fetchHtml(http, listUrl, ctx, cache, `html:${listUrl}`)
        if (listHtml) parsed = parseListingHtml(listHtml, base)

        if (parsed.length === 0 && page === 1 && cat.homeRail) {
          const homeHtml = await fetchHtml(http, base + '/', ctx, cache, `html:${base}:home`)
          if (homeHtml) parsed = parseHomeRail(homeHtml, base, cat.homeRail)
        }

        parsed = parsed.filter(
          (it) => it.type === cat.type || cat.id === 'f2media_coming_soon',
        )

        const items = mapItems(parsed.slice(0, 24))
        await enrichList(items, 18)
        cache.set(cacheKey, items, CACHE_LIST_MS)
        logger.info?.('f2media browse', {
          catalogId,
          page,
          count: items.length,
          posters: items.filter((i) => i.poster).length,
        })
        return items
      } catch (err) {
        logger.warn?.('f2media browse failed', { message: err.message, catalogId })
        return []
      }
    },

    async getDetail(itemId, type, ctx = {}) {
      const pagePath = decodePageId(itemId)
      if (!pagePath) {
        logger.warn?.('bad itemId', { itemId })
        return null
      }
      const base = this.baseUrl(ctx.config || {})
      const cacheKey = `detail:${base}:${pagePath}`
      const hit = cache.get(cacheKey)
      if (hit && hit.streams && hit.streams.length > 0) return hit
      if (hit && hit.videos && hit.videos.length > 0) return hit

      try {
        const pageUrl = `${base}/${pagePath}`
        const res = await http.get(pageUrl, { timeoutMs: ctx.timeoutMs || 15_000 })
        if (!res.ok) {
          logger.warn?.('detail HTTP', { status: res.status, pageUrl })
          return null
        }
        const html = await res.text()
        const meta = parseDetailMeta(html, base)

        const isSeries =
          type === 'series' ||
          /\/series\//i.test(pagePath) ||
          (meta.type === 'series' && /\/series\//i.test(pagePath))

        // Streams first — independent of Cinemeta
        let streams = []
        let episodes = []
        let videos = []

        if (isSeries) {
          const parsed = parseSeriesEpisodes(html, base)
          episodes = parsed.episodes
          videos = parsed.videos
          streams = episodes.flatMap((e) => e.streams)
          if (streams.length === 0) {
            streams = parseDetailStreams(html, base)
          }
        } else {
          streams = parseDetailStreams(html, base)
        }

        // Optional enrich; failure leaves streams intact
        let img = {}
        try {
          img = await lookupImages(meta.title, meta.year, isSeries ? 'series' : 'movie')
        } catch {
          img = {}
        }

        // Prefer site IMDb when present for stable metahub URLs
        const imdb = meta.imdb || img.imdb
        const poster =
          (imdb && metahubPoster(imdb)) || img.poster || undefined
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

        logger.info?.('f2media detail', {
          pagePath,
          type: detail.type,
          streams: streams.length,
          videos: videos.length,
          poster: Boolean(detail.poster),
        })
        return detail
      } catch (err) {
        logger.warn?.('f2media detail failed', { message: err.message, itemId })
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
        if (detail.streams?.length) return detail.streams.map(toStream)
        return []
      }

      if (!detail.streams?.length) return []
      return detail.streams.map(toStream)
    },

    resolveExternalId(detail) {
      if (detail?.imdb) return { imdb: detail.imdb }
      return null
    },

    toClientCatalogId(item) {
      const raw = item.internalId?.replace(/^cg:f2media:/, '') || ''
      return toStremioProviderId('f2media', raw)
    },
  }
}

function toStream(s) {
  return {
    url: s.url,
    name: s.badge || s.name || 'HD',
    title: s.label || s.title,
    quality: s.quality,
    providerKey: 'f2media',
  }
}

function mapItems(parsed) {
  return (parsed || []).map((item) => ({
    internalId: makeInternalId('f2media', item.itemId),
    type: item.type,
    title: item.title,
    year: item.year,
    poster: undefined,
    providerKey: 'f2media',
    externalRefs: { pagePath: item.pagePath },
  }))
}

async function fetchHtml(http, url, ctx, cache, cacheKey) {
  const hit = cache.get(cacheKey)
  if (typeof hit === 'string' && hit.length > 500) return hit
  const res = await http.get(url, { timeoutMs: ctx.timeoutMs || 15_000 })
  if (!res.ok) return null
  const text = await res.text()
  if (text && text.length > 500) cache.set(cacheKey, text, CACHE_HTML_MS)
  return text
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

export default createF2MediaProvider
