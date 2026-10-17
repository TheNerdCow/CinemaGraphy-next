/**
 * AslMoviez provider (aslmoviez.com) — independent module.
 * Catalogs: film / series / anime / doc. IMDb id often in page path (tt…).
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
  imdbFromPath,
} from './parse.js'
import {
  getCatalogById,
  toManifestCatalogs,
  catalogListUrl,
  ASL_MOVIE_GENRES,
  ASL_SERIES_GENRES,
} from './catalogs.js'

const DEFAULT_BASE = 'https://aslmoviez.com'
/** Site list pages typically ~20–24 cards. */
const PAGE_SIZE = 24
const CACHE_LIST_MS = 8 * 60_000
const CACHE_EMPTY_MS = 20_000
const CACHE_DETAIL_MS = 10 * 60_000
const CACHE_META_MS = 30 * 60_000

export function createAslMoviezProvider(deps = {}) {
  const http = deps.http || createHttpClient({ maxConcurrent: 5, timeoutMs: 18_000 })
  const metaHttp = deps.metaHttp || createHttpClient({ maxConcurrent: 4, timeoutMs: 6_000 })
  const logger = deps.logger || console
  const cinemeta = deps.cinemeta || createCinemetaClient({ http: metaHttp })
  const cache = deps.cache || createMemoryCache(CACHE_LIST_MS)

  async function lookupImages(title, year, type, imdbHint) {
    const out = {}
    if (imdbHint) {
      out.imdb = imdbHint
      out.poster = metahubPoster(imdbHint)
      out.background = metahubBackground(imdbHint)
    }
    if (!title && !imdbHint) return out
    const key = `asl-meta:${type}:${imdbHint || title}:${year || ''}`
    const hit = cache.get(key)
    if (hit !== undefined) return { ...out, ...hit }

    try {
      if (imdbHint) {
        const meta = await withTimeout(cinemeta.byImdb(imdbHint, type === 'series' ? 'series' : 'movie'), 4500)
        if (meta) {
          out.description = meta.description
          out.genres = meta.genres
          out.imdbRating = meta.imdbRating
          if (meta.poster) out.poster = meta.poster
          if (meta.background) out.background = meta.background
        }
      } else if (title) {
        const t = type === 'series' ? 'series' : 'movie'
        const q = year ? `${title} ${year}` : title
        const found = await withTimeout(cinemeta.search(q, t), 4500)
        if (found?.imdb) {
          out.imdb = found.imdb
          out.poster = metahubPoster(found.imdb) || found.poster
          out.background = metahubBackground(found.imdb) || found.background || out.poster
          out.description = found.description
          out.genres = found.genres
          out.imdbRating = found.imdbRating
        }
      }
    } catch {
      /* optional */
    }
    cache.set(key, out, CACHE_META_MS)
    return out
  }

  async function enrichMissing(items, limit = 14) {
    const need = items.filter((i) => !i.poster).slice(0, limit)
    await Promise.all(
      need.map(async (it) => {
        try {
          const img = await lookupImages(it.title, it.year, it.type, it.imdb)
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
    key: 'aslmoviez',
    name: 'AslMoviez',
    capabilities: {
      search: true,
      browseCatalogs: toManifestCatalogs(),
      movieGenres: ASL_MOVIE_GENRES,
      seriesGenres: ASL_SERIES_GENRES,
      streams: true,
      providerMeta: true,
      auth: 'none',
    },

    isEnabled(config) {
      const p = config.providers?.aslmoviez
      if (p?.enabled === false) return false
      if (config.providersEnabled?.length) {
        return config.providersEnabled.includes('aslmoviez')
      }
      return true
    },

    baseUrl(config) {
      const fromConfig = config.providers?.aslmoviez?.baseUrl
      const fromEnv = process.env.ASLMOVIEZ_BASEURL
      const raw = (fromConfig || fromEnv || DEFAULT_BASE).trim()
      return raw.replace(/\/+$/, '') || DEFAULT_BASE
    },

    async search(query, ctx = {}) {
      const q = String(query || '').trim()
      if (!q) return []
      const base = this.baseUrl(ctx.config || {})
      const skip = Number(ctx.skip) || 0
      const page = Math.floor(skip / PAGE_SIZE) + 1
      const cacheKey = `asl-search:${base}:${q.toLowerCase()}:${page}`
      const hit = cache.get(cacheKey)
      if (Array.isArray(hit) && hit.length) return hit

      try {
        const url =
          page <= 1
            ? `${base}/?s=${encodeURIComponent(q)}`
            : `${base}/page/${page}/?s=${encodeURIComponent(q)}`
        const res = await http.get(url, { timeoutMs: ctx.timeoutMs || 18_000 })
        if (!res.ok) return []
        const parsed = parseSearchHtml(await res.text(), base)
        const items = mapItems(parsed)
        await enrichMissing(items, 16)
        cache.set(cacheKey, items, items.length ? CACHE_LIST_MS : CACHE_EMPTY_MS)
        logger.info?.('aslmoviez search', { q, page, count: items.length })
        return items
      } catch (err) {
        logger.warn?.('aslmoviez search failed', { message: err.message })
        return []
      }
    },

    async browseType(type, ctx = {}) {
      const kind = type === 'series' ? 'series' : 'film'
      const path = kind === 'series' ? '/series' : '/film'
      return this._browsePath(path, type === 'series' ? 'series' : 'movie', ctx, `type:${kind}`)
    },

    async browseGenre(type, genre, ctx = {}) {
      // Site uses filter UI; genre path when available: /genre/…
      const g = String(genre || '').trim()
      if (!g) return this.browseType(type, ctx)
      const slug = encodeURIComponent(g)
      // Prefer /film or /series with search-like fallback via site search
      return this.search(g, ctx)
    },

    async browse(catalogId, ctx = {}) {
      const cat = getCatalogById(catalogId)
      if (!cat) return []
      return this._browsePath(cat.path, cat.type, ctx, catalogId)
    },

    async _browsePath(path, type, ctx = {}, catalogId = path) {
      const base = this.baseUrl(ctx.config || {})
      const skip = Number(ctx.skip) || 0
      const page = Math.floor(skip / PAGE_SIZE) + 1
      const cacheKey = `asl-browse:${base}:${catalogId}:${page}`
      const hit = cache.get(cacheKey)
      if (Array.isArray(hit) && hit.length) return hit

      try {
        const listUrl = catalogListUrl(base, { path }, page)
        const res = await http.get(listUrl, { timeoutMs: ctx.timeoutMs || 18_000 })
        if (!res.ok) {
          logger.warn?.('aslmoviez browse HTTP', { status: res.status, listUrl })
          return []
        }
        const html = await res.text()
        let parsed = parseListingHtml(html, base, type)
        parsed = parsed.map((it) => ({ ...it, type: type || it.type }))
        const items = mapItems(parsed)
        await enrichMissing(items, 16)
        cache.set(cacheKey, items, items.length ? CACHE_LIST_MS : CACHE_EMPTY_MS)
        logger.info?.('aslmoviez browse', {
          catalogId,
          page,
          listUrl,
          count: items.length,
        })
        return items
      } catch (err) {
        logger.warn?.('aslmoviez browse failed', { message: err.message, catalogId })
        return []
      }
    },

    async getDetail(itemId, type, ctx = {}) {
      const pagePath = decodePageId(itemId)
      if (!pagePath) return null
      const base = this.baseUrl(ctx.config || {})
      const cacheKey = `asl-detail:${base}:${pagePath}`
      const hit = cache.get(cacheKey)
      if (hit && (hit.streams?.length || hit.videos?.length)) return hit

      try {
        const pageUrl = `${base}/${pagePath}`
        const res = await http.get(pageUrl, { timeoutMs: ctx.timeoutMs || 18_000 })
        if (!res.ok) {
          logger.warn?.('aslmoviez detail HTTP', { status: res.status, pageUrl })
          return null
        }
        const html = await res.text()
        const meta = parseDetailMeta(html, base)
        const streams = parseDetailStreams(html, base)
        const pathImdb = imdbFromPath(pagePath)

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

        const imdb = meta.imdb || pathImdb
        let img = {}
        try {
          img = await lookupImages(
            meta.title,
            meta.year,
            isSeries ? 'series' : 'movie',
            imdb,
          )
        } catch {
          img = {}
        }

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
          imdb: imdb || img.imdb,
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
        logger.info?.('aslmoviez detail', {
          pagePath,
          type: detail.type,
          streams: streams.length,
          videos: videos.length,
          imdb: detail.imdb,
        })
        return detail
      } catch (err) {
        logger.warn?.('aslmoviez detail failed', { message: err.message, itemId })
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
      const raw = item.internalId?.replace(/^cg:aslmoviez:/, '') || ''
      return toStremioProviderId('aslmoviez', raw)
    },
  }
}

function toStream(s) {
  return {
    url: s.url,
    name: s.badge || s.name || 'HD',
    title: s.label || s.title,
    quality: s.quality,
    providerKey: 'aslmoviez',
  }
}

function mapItems(parsed) {
  return (parsed || []).map((item) => ({
    internalId: makeInternalId('aslmoviez', item.itemId),
    type: item.type,
    title: item.title,
    year: item.year,
    poster: item.poster || undefined,
    imdb: item.imdb,
    providerKey: 'aslmoviez',
    externalRefs: { pagePath: item.pagePath, imdb: item.imdb },
  }))
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

export default createAslMoviezProvider
