/**
 * F2Media provider — fast streams/search first; Cinemeta poster optional (catalog cards only).
 */

import { makeInternalId, toStremioProviderId } from '../../core/ids/namespace.js'
import { createHttpClient } from '../../core/http/client.js'
import { createMemoryCache } from '../../core/cache/memory.js'
import { isStrictTitleMatch } from '../../core/meta/match.js'
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
const CACHE_LIST_MS = 10 * 60_000
const CACHE_DETAIL_MS = 12 * 60_000
const CACHE_HTML_MS = 8 * 60_000
const CACHE_POSTER_MS = 24 * 60_000

export function createF2MediaProvider(deps = {}) {
  // Separate clients so Cinemeta never blocks F2Media HTML fetches
  const http = deps.http || createHttpClient({ maxConcurrent: 4, timeoutMs: 12_000 })
  const metaHttp = deps.metaHttp || createHttpClient({ maxConcurrent: 4, timeoutMs: 4_000 })
  const logger = deps.logger || console
  const cinemeta = deps.cinemeta || createCinemetaClient({ http: metaHttp })
  const cache = deps.cache || createMemoryCache(CACHE_LIST_MS)

  /** Best-effort poster for catalog cards — never throws, never blocks long */
  async function catalogPoster(title, year, type) {
    if (!title) return undefined
    const key = `poster:${type}:${title}:${year || ''}`
    const cached = cache.get(key)
    if (cached !== undefined) return cached?.poster

    try {
      const q = year ? `${title} ${year}` : title
      const found = await Promise.race([
        cinemeta.search(q, type === 'series' ? 'series' : 'movie'),
        new Promise((r) => setTimeout(() => r(null), 3500)),
      ])
      if (!found?.imdb || !isStrictTitleMatch(title, found.name, year)) {
        cache.set(key, { poster: undefined }, CACHE_POSTER_MS)
        return undefined
      }
      const poster = metahubPoster(found.imdb) || found.poster
      cache.set(key, { poster, imdb: found.imdb }, CACHE_POSTER_MS)
      return poster
    } catch {
      return undefined
    }
  }

  async function attachPosters(items, limit = 12) {
    const slice = items.slice(0, limit)
    await Promise.all(
      slice.map(async (it) => {
        it.poster = await catalogPoster(it.title, it.year, it.type)
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
      const cacheKey = `search:${base}:${q}`
      const hit = cache.get(cacheKey)
      if (hit) return hit

      try {
        const res = await http.get(`${base}/?s=${encodeURIComponent(q)}`, {
          timeoutMs: ctx.timeoutMs || 12_000,
        })
        if (!res.ok) return []
        const items = mapItems(parseSearchHtml(await res.text(), base))
        // posters optional — don't fail search
        await attachPosters(items, 10)
        cache.set(cacheKey, items, CACHE_LIST_MS)
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
        await attachPosters(items, 12)
        cache.set(cacheKey, items, CACHE_LIST_MS)
        logger.info?.('f2media browse', {
          catalogId,
          page,
          count: items.length,
          withPoster: items.filter((i) => i.poster).length,
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
      // Only reuse cache if it has streams or series videos (avoid sticky empty)
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

        // Optional Cinemeta for card poster only — never required for streams
        let poster
        let background
        let imdb = meta.imdb
        let description = meta.description
        let genres
        let imdbRating
        let runtime

        try {
          const cm = await Promise.race([
            (async () => {
              if (meta.imdb) {
                const byId = await cinemeta.byImdb(meta.imdb, isSeries ? 'series' : 'movie')
                if (byId && (!meta.title || isStrictTitleMatch(meta.title, byId.name, meta.year))) {
                  return byId
                }
              }
              if (meta.title) {
                const q = meta.year ? `${meta.title} ${meta.year}` : meta.title
                const found = await cinemeta.search(q, isSeries ? 'series' : 'movie')
                if (found && isStrictTitleMatch(meta.title, found.name, meta.year)) return found
              }
              return null
            })(),
            new Promise((r) => setTimeout(() => r(null), 4000)),
          ])
          if (cm?.imdb) {
            imdb = cm.imdb
            poster = metahubPoster(cm.imdb) || cm.poster
            // background optional — user asked for catalog poster mainly
            background = metahubBackground(cm.imdb) || poster
            if (cm.description && cm.description.length > 40) description = cm.description
            genres = cm.genres
            imdbRating = cm.imdbRating
            runtime = cm.runtime
          }
        } catch {
          /* ignore meta errors */
        }

        const detail = {
          id: itemId,
          pagePath,
          type: isSeries ? 'series' : 'movie',
          title: meta.title,
          year: meta.year,
          imdb,
          poster,
          background,
          description,
          genres,
          imdbRating,
          runtime,
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
