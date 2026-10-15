/**
 * F2Media — multi-query search, stream-first detail, optional TMDB + Cinemeta posters.
 */

import { makeInternalId, toStremioProviderId } from '../../core/ids/namespace.js'
import { createHttpClient } from '../../core/http/client.js'
import { createMemoryCache } from '../../core/cache/memory.js'
import { isStrictTitleMatch, isPosterMatch } from '../../core/meta/match.js'
import {
  createCinemetaClient,
  metahubPoster,
  metahubBackground,
} from '../../core/meta/cinemeta.js'
import { createTmdbClient } from '../../core/meta/tmdb.js'
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
const CACHE_LIST_MS = 10 * 60_000
const CACHE_DETAIL_MS = 12 * 60_000
const CACHE_HTML_MS = 8 * 60_000
const CACHE_POSTER_MS = 24 * 60_000

export function createF2MediaProvider(deps = {}) {
  const http = deps.http || createHttpClient({ maxConcurrent: 5, timeoutMs: 14_000 })
  const metaHttp = deps.metaHttp || createHttpClient({ maxConcurrent: 5, timeoutMs: 5_000 })
  const logger = deps.logger || console
  const cinemeta = deps.cinemeta || createCinemetaClient({ http: metaHttp })
  const tmdb = deps.tmdb || createTmdbClient({ http: metaHttp })
  const cache = deps.cache || createMemoryCache(CACHE_LIST_MS)

  async function resolveImages(title, year, type) {
    if (!title) return {}
    const key = `img:${type}:${title}:${year || ''}`
    const cached = cache.get(key)
    if (cached !== undefined) return cached

    const out = {}
    const t = type === 'series' ? 'series' : 'movie'

    // 1) TMDB if configured (best posters/backdrops)
    if (tmdb.enabled) {
      try {
        const q = year ? `${title}` : title
        const row = await Promise.race([
          tmdb.search(q, t),
          new Promise((r) => setTimeout(() => r(null), 4000)),
        ])
        if (row && isPosterMatch(title, row.name, year, row.year)) {
          out.poster = row.poster
          out.background = row.background
          out.imdb = row.imdb
          out.description = row.description
          out.genres = row.genres
          out.imdbRating = row.imdbRating
          out.source = 'tmdb'
        }
      } catch {
        /* ignore */
      }
    }

    // 2) Cinemeta / metahub fallback
    if (!out.poster) {
      try {
        const q = year ? `${title} ${year}` : title
        const found = await Promise.race([
          cinemeta.search(q, t),
          new Promise((r) => setTimeout(() => r(null), 3500)),
        ])
        if (found?.imdb && isPosterMatch(title, found.name, year, found.year)) {
          out.poster = metahubPoster(found.imdb) || found.poster
          out.background = metahubBackground(found.imdb) || found.background || out.poster
          out.imdb = found.imdb
          if (!out.description) out.description = found.description
          if (!out.genres) out.genres = found.genres
          if (!out.imdbRating) out.imdbRating = found.imdbRating
          out.source = 'cinemeta'
        }
      } catch {
        /* ignore */
      }
    }

    cache.set(key, out, CACHE_POSTER_MS)
    return out
  }

  async function attachImages(items, limit = 14) {
    const slice = items.slice(0, limit)
    await Promise.all(
      slice.map(async (it) => {
        const img = await resolveImages(it.title, it.year, it.type)
        if (img.poster) it.poster = img.poster
        if (img.imdb) it.imdb = img.imdb
      }),
    )
    return items
  }

  /** Multiple query variants to catch titles F2 search misses */
  function searchQueries(raw) {
    const q = String(raw || '').trim()
    if (!q) return []
    const set = new Set()
    set.add(q)
    // without year
    const noYear = q.replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim()
    if (noYear && noYear !== q) set.add(noYear)
    // first 3-5 significant words
    const words = noYear.split(/\s+/).filter(Boolean)
    if (words.length > 3) set.add(words.slice(0, 3).join(' '))
    if (words.length > 4) set.add(words.slice(0, 4).join(' '))
    // hyphen/colon variants
    set.add(q.replace(/:/g, ' ').replace(/\s+/g, ' ').trim())
    set.add(q.replace(/-/g, ' ').replace(/\s+/g, ' ').trim())
    return [...set].filter((s) => s.length >= 2).slice(0, 4)
  }

  async function searchOnce(base, q, timeoutMs) {
    const url = `${base}/?s=${encodeURIComponent(q)}`
    const res = await http.get(url, { timeoutMs })
    if (!res.ok) return []
    return parseSearchHtml(await res.text(), base)
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
      tmdb: Boolean(tmdb.enabled),
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
      if (hit) return hit

      try {
        const variants = searchQueries(q)
        const merged = []
        const seen = new Set()
        for (const v of variants) {
          try {
            const rows = await searchOnce(base, v, ctx.timeoutMs || 12_000)
            for (const r of rows) {
              if (seen.has(r.pagePath)) continue
              seen.add(r.pagePath)
              merged.push(r)
            }
            if (merged.length >= 8) break
          } catch {
            /* try next variant */
          }
        }
        const items = mapItems(merged)
        await attachImages(items, 12)
        cache.set(cacheKey, items, CACHE_LIST_MS)
        logger.info?.('f2media search', { q, variants: variants.length, count: items.length })
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
      if (hit) return hit

      try {
        let parsed = []
        if (page === 1 && cat.homeRail) {
          const homeHtml = await fetchHtml(http, base + '/', ctx, cache, `html:${base}:home`)
          if (homeHtml) parsed = parseHomeRail(homeHtml, base, cat.homeRail)
        }
        if (parsed.length === 0) {
          const url = catalogListUrl(base, cat, page)
          const html = await fetchHtml(http, url, ctx, cache, `html:${url}`)
          if (html) parsed = parseListingHtml(html, base)
        }
        parsed = parsed.filter(
          (it) => it.type === cat.type || cat.id === 'f2media_coming_soon',
        )
        const items = mapItems(parsed.slice(0, 24))
        await attachImages(items, 16)
        cache.set(cacheKey, items, CACHE_LIST_MS)
        logger.info?.('f2media browse', {
          catalogId,
          page,
          count: items.length,
          posters: items.filter((i) => i.poster).length,
          tmdb: tmdb.enabled,
        })
        return items
      } catch (err) {
        logger.warn?.('f2media browse failed', { message: err.message, catalogId })
        return []
      }
    },

    async getDetail(itemId, type, ctx = {}) {
      const pagePath = decodePageId(itemId)
      if (!pagePath) return null
      const base = this.baseUrl(ctx.config || {})
      const cacheKey = `detail:${base}:${pagePath}`
      const hit = cache.get(cacheKey)
      if (hit && ((hit.streams && hit.streams.length) || (hit.videos && hit.videos.length))) {
        return hit
      }

      try {
        const res = await http.get(`${base}/${pagePath}`, {
          timeoutMs: ctx.timeoutMs || 14_000,
        })
        if (!res.ok) return null
        const html = await res.text()
        const meta = parseDetailMeta(html, base)

        const isSeries =
          type === 'series' || meta.type === 'series' || /\/series\//i.test(pagePath)

        let streams = []
        let episodes = []
        let videos = []
        if (isSeries) {
          const parsed = parseSeriesEpisodes(html, base)
          episodes = parsed.episodes
          videos = parsed.videos
          streams = episodes.flatMap((e) => e.streams)
        } else {
          streams = parseDetailStreams(html, base)
        }

        // Images AFTER streams — never block playback
        const img = await resolveImages(
          meta.title,
          meta.year,
          isSeries ? 'series' : 'movie',
        )

        const detail = {
          id: itemId,
          pagePath,
          type: isSeries ? 'series' : 'movie',
          title: meta.title,
          year: meta.year,
          imdb: img.imdb || meta.imdb,
          poster: img.poster,
          background: img.background || img.poster,
          description: img.description || meta.description,
          genres: img.genres,
          imdbRating: img.imdbRating,
          streams,
          episodes,
          videos,
        }

        if (streams.length || videos.length) {
          cache.set(cacheKey, detail, CACHE_DETAIL_MS)
        }
        logger.info?.('f2media detail', {
          pagePath,
          streams: streams.length,
          videos: videos.length,
          poster: Boolean(detail.poster),
        })
        return detail
      } catch (err) {
        logger.warn?.('f2media detail failed', { message: err.message })
        return null
      }
    },

    async getStreams(detail, videoCtx = null) {
      const season = videoCtx?.season
      const episode = videoCtx?.episode
      if (detail?.type === 'series' && season != null && episode != null) {
        const ep = (detail.episodes || []).find(
          (e) => e.season === Number(season) && e.episode === Number(episode),
        )
        if (!ep?.streams?.length) return []
        return ep.streams.map(toStream)
      }
      if (!detail?.streams?.length) return []
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
  if (typeof hit === 'string' && hit.length > 100) return hit
  const res = await http.get(url, { timeoutMs: ctx.timeoutMs || 12_000 })
  if (!res.ok) return null
  const text = await res.text()
  cache.set(cacheKey, text, CACHE_HTML_MS)
  return text
}

export default createF2MediaProvider
