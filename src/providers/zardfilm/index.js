/**
 * ZardFilm provider (zardfilm.in) — free, no cookie.
 * Catalogs: foreign / dubbed / animation / anime / foreign series / dubbed / KR / TR / CN.
 * Skips Iranian movie & series catalogs.
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
  groupEpisodeStreams,
  buildSeriesVideos,
  decodePageId,
  encodePageId,
} from './parse.js'
import {
  getCatalogById,
  toManifestCatalogs,
  catalogListUrl,
  ZF_CATALOGS,
} from './catalogs.js'

const DEFAULT_BASE = 'https://zardfilm.in'
const PAGE_SIZE = 24
const CACHE_LIST_MS = 8 * 60_000
const CACHE_EMPTY_MS = 20_000
const CACHE_DETAIL_MS = 10 * 60_000

export function createZardFilmProvider(deps = {}) {
  const http = deps.http || createHttpClient({ maxConcurrent: 5, timeoutMs: 20_000 })
  const metaHttp = deps.metaHttp || createHttpClient({ maxConcurrent: 4, timeoutMs: 6_000 })
  const logger = deps.logger || console
  const cinemeta = deps.cinemeta || createCinemetaClient({ http: metaHttp })
  const cache = deps.cache || createMemoryCache(CACHE_LIST_MS)
  const baseUrl = String(deps.baseUrl || DEFAULT_BASE).replace(/\/+$/, '')

  async function fetchHtml(url) {
    const res = await http.get(url, {
      timeoutMs: 20_000,
      headers: { Referer: baseUrl + '/' },
    })
    if (!res?.ok) {
      const err = new Error(`HTTP ${res?.status || 0}`)
      err.status = res?.status
      throw err
    }
    return await res.text()
  }

  async function lookupImages(title, year, type, imdbHint) {
    const out = {}
    if (imdbHint) {
      out.imdb = imdbHint
      out.poster = metahubPoster(imdbHint)
      out.background = metahubBackground(imdbHint)
    }
    if (!title && !imdbHint) return out
    const key = `zf-meta:${type}:${imdbHint || title}:${year || ''}`
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
          out.poster = found.poster || metahubPoster(found.imdb)
          out.background = found.background || metahubBackground(found.imdb)
          out.description = found.description
          out.genres = found.genres
          out.imdbRating = found.imdbRating
        }
      }
      cache.set(key, out, CACHE_DETAIL_MS)
    } catch (err) {
      logger.warn?.('zardfilm meta', { message: err.message })
    }
    return out
  }

  return {
    key: 'zardfilm',
    name: 'ZardFilm',
    capabilities: {
      search: true,
      browseCatalogs: toManifestCatalogs(),
      movieGenres: [],
      seriesGenres: [],
    },

    isEnabled(config) {
      const p = config?.providers?.zardfilm
      if (p?.enable === false) return false
      const list = config?.providersEnabled
      if (Array.isArray(list) && list.length) return list.includes('zardfilm')
      return true
    },

    async search(query, ctx = {}) {
      const q = String(query || '').trim()
      if (!q) return []
      const skip = Number(ctx.skip) || 0
      const page = Math.floor(skip / PAGE_SIZE) + 1
      const cacheKey = `zf-search:${q.toLowerCase()}:${page}`
      const hit = cache.get(cacheKey)
      if (Array.isArray(hit) && hit.length) return hit
      try {
        if (page > 1) return []
        const url = `${baseUrl}/?s=${encodeURIComponent(q)}`
        const html = await fetchHtml(url)
        const items = parseSearchHtml(html, baseUrl)
        const mapped = mapItems(items)
        cache.set(cacheKey, mapped, mapped.length ? CACHE_LIST_MS : CACHE_EMPTY_MS)
        logger.info?.('zardfilm search', { q, count: mapped.length })
        return mapped
      } catch (err) {
        logger.warn?.('zardfilm search failed', { message: err.message, q })
        return []
      }
    },

    async browse(catalogId, ctx = {}) {
      const cat = getCatalogById(catalogId)
      if (!cat) {
        logger.warn?.('zardfilm unknown catalog', { catalogId })
        return []
      }
      const skip = Number(ctx.skip) || 0
      const page = Math.floor(skip / PAGE_SIZE) + 1
      const cacheKey = `zf-browse:${catalogId}:${page}`
      const hit = cache.get(cacheKey)
      if (Array.isArray(hit) && hit.length) return hit
      try {
        const url = catalogListUrl(baseUrl, cat, page)
        logger.info?.('zardfilm browse', { catalogId, page, url })
        const html = await fetchHtml(url)
        const items = parseListingHtml(html, baseUrl, cat.type)
        const mapped = mapItems(items)
        cache.set(cacheKey, mapped, mapped.length ? CACHE_LIST_MS : CACHE_EMPTY_MS)
        logger.info?.('zardfilm browse done', { catalogId, page, count: mapped.length })
        return mapped
      } catch (err) {
        logger.warn?.('zardfilm browse failed', { message: err.message, catalogId })
        return []
      }
    },

    async getCatalog(catalogId, opts = {}) {
      return this.browse(catalogId, opts)
    },

    async getDetail(itemId, type, opts = {}) {
      const pagePath = decodePageId(itemId) || String(itemId || '').replace(/^\/+/, '')
      if (!pagePath) return null
      const cacheKey = `zf-detail:${pagePath}`
      const hit = cache.get(cacheKey)
      if (hit !== undefined) return hit
      try {
        const url = `${baseUrl}/${pagePath.replace(/^\/+/, '')}/`
        const html = await fetchHtml(url)
        const meta = parseDetailMeta(html, baseUrl, pagePath)
        const streams = parseDetailStreams(html)
        const forceType = type === 'series' || type === 'movie' ? type : meta.type
        const episodes = forceType === 'series' ? groupEpisodeStreams(streams) : []
        const videos = forceType === 'series' ? buildSeriesVideos(episodes) : []
        const img = await lookupImages(meta.title, meta.year, forceType, meta.imdb)
        const detail = {
          internalId: makeInternalId('zardfilm', encodePageId(pagePath)),
          type: forceType,
          title: meta.title,
          year: meta.year,
          poster: img.poster || meta.poster,
          background: img.background,
          imdb: img.imdb || meta.imdb,
          description: img.description,
          genres: img.genres,
          imdbRating: img.imdbRating,
          streams: forceType === 'movie' ? streams : streams.filter((s) => s.episode == null),
          episodes,
          videos,
          providerKey: 'zardfilm',
          externalRefs: { pagePath, imdb: img.imdb || meta.imdb },
        }
        cache.set(cacheKey, detail, streams.length || videos.length ? CACHE_DETAIL_MS : 60_000)
        logger.info?.('zardfilm detail', { pagePath, type: detail.type, streams: streams.length, videos: videos.length, imdb: detail.imdb })
        return detail
      } catch (err) {
        logger.warn?.('zardfilm detail failed', { message: err.message, itemId })
        return null
      }
    },

    async getStreams(detail, videoCtx = null) {
      if (!detail) return []
      const season = videoCtx?.season
      const episode = videoCtx?.episode
      if (detail.type === 'series' && season != null && episode != null) {
        const ep = (detail.episodes || []).find((e) => Number(e.season) === Number(season) && Number(e.episode) === Number(episode))
        if (ep?.streams?.length) return ep.streams.map(toStream)
        const tagged = (detail.streams || []).filter((s) => Number(s.season || 1) === Number(season) && Number(s.episode) === Number(episode))
        if (tagged.length) return tagged.map(toStream)
        return []
      }
      if (!detail.streams?.length) return []
      if (detail.type === 'series') return detail.streams.filter((s) => !s.episode).map(toStream)
      return detail.streams.map(toStream)
    },

    toClientCatalogId(item) {
      const raw = item.internalId?.replace(/^cg:zardfilm:/, '') || ''
      return toStremioProviderId('zardfilm', raw)
    },
  }
}

function toStream(s) {
  const badge = s.badge || s.name || 'HD'
  return {
    url: s.url,
    name: `ZardFilm ${badge}`,
    title: s.label || s.title || badge,
    quality: s.quality,
    providerKey: 'zardfilm',
  }
}

function mapItems(parsed) {
  return (parsed || []).map((item) => ({
    internalId: makeInternalId('zardfilm', item.itemId),
    type: item.type,
    title: item.title,
    year: item.year,
    poster: item.poster || undefined,
    imdb: item.imdb,
    providerKey: 'zardfilm',
    externalRefs: { pagePath: item.pagePath, imdb: item.imdb },
  }))
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))])
}

export default createZardFilmProvider
