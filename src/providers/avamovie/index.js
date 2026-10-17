/**
 * AvaMovie provider — subscription / cookie session.
 * Primary host: avamovie.shop (avadel.top often unreachable outside IR).
 * Requires AVAMOVIE_COOKIE (or session cookie from landing) for listings & streams.
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
import {
  getCatalogById,
  toManifestCatalogs,
  catalogListUrl,
  genreListUrl,
  AVA_MOVIE_GENRES,
  AVA_SERIES_GENRES,
} from './catalogs.js'

const DEFAULT_BASE = 'https://avamovie.shop'
const MIRROR_BASES = ['https://avamovie.shop', 'https://avadel.top']
const PAGE_SIZE = 24
const CACHE_LIST_MS = 8 * 60_000
const CACHE_EMPTY_MS = 12_000
const CACHE_DETAIL_MS = 10 * 60_000
const CACHE_META_MS = 30 * 60_000

export function createAvaMovieProvider(deps = {}) {
  const http = deps.http || createHttpClient({ maxConcurrent: 4, timeoutMs: 25_000 })
  const metaHttp = deps.metaHttp || createHttpClient({ maxConcurrent: 4, timeoutMs: 6_000 })
  const logger = deps.logger || console
  const cinemeta = deps.cinemeta || createCinemetaClient({ http: metaHttp })
  const cache = deps.cache || createMemoryCache(CACHE_LIST_MS)

  function cookieOf(config) {
    const fromConfig = config?.providers?.avamovie?.cookie
    const fromEnv = process.env.AVAMOVIE_COOKIE
    return String(fromConfig || fromEnv || '').trim()
  }

  function authHeaders(config) {
    const cookie = cookieOf(config)
    if (!cookie) return {}
    return {
      Cookie: cookie,
      Referer: `${thisBase(config)}/`,
    }
  }

  function thisBase(config) {
    const fromConfig = config?.providers?.avamovie?.baseUrl
    const fromEnv = process.env.AVAMOVIE_BASEURL
    const raw = (fromConfig || fromEnv || DEFAULT_BASE).trim()
    return raw.replace(/\/+$/, '') || DEFAULT_BASE
  }

  function candidateBases(config) {
    const primary = thisBase(config)
    const list = [primary, ...MIRROR_BASES]
    const seen = new Set()
    const out = []
    for (const b of list) {
      const n = String(b || '').replace(/\/+$/, '')
      if (!n || seen.has(n)) continue
      seen.add(n)
      out.push(n)
    }
    return out
  }

  async function fetchHtml(pathOrUrl, config, timeoutMs) {
    const bases = candidateBases(config)
    const headers = authHeaders(config)
    let lastErr = null
    for (const base of bases) {
      const url = pathOrUrl.startsWith('http')
        ? pathOrUrl.replace(/^https?:\/\/[^/]+/i, base)
        : `${base}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`
      try {
        const res = await http.get(url, { timeoutMs: timeoutMs || 25_000, headers })
        if (!res.ok) {
          lastErr = new Error(`HTTP ${res.status} ${url}`)
          logger.warn?.('avamovie HTTP', { status: res.status, url })
          continue
        }
        const html = await res.text()
        if (!html || html.length < 400) {
          lastErr = new Error(`short body ${url}`)
          continue
        }
        return { html, base, url, status: res.status }
      } catch (err) {
        lastErr = err
        logger.warn?.('avamovie fetch failed', { url, message: err.message })
      }
    }
    throw lastErr || new Error('avamovie unreachable')
  }

  async function lookupImages(title, year, type) {
    if (!title) return {}
    const key = `ava-meta:${type}:${title}:${year || ''}`
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
    key: 'avamovie',
    name: 'AvaMovie',
    capabilities: {
      search: true,
      browseCatalogs: toManifestCatalogs(),
      movieGenres: AVA_MOVIE_GENRES,
      seriesGenres: AVA_SERIES_GENRES,
      streams: true,
      providerMeta: true,
      auth: 'cookie',
    },

    isEnabled(config) {
      const p = config.providers?.avamovie
      if (p?.enabled === false) return false
      if (!cookieOf(config) && p?.enabled !== true) return false
      if (config.providersEnabled?.length) {
        return config.providersEnabled.includes('avamovie')
      }
      return true
    },

    baseUrl(config) {
      return thisBase(config)
    },

    async search(query, ctx = {}) {
      const q = String(query || '').trim()
      if (!q) return []
      const config = ctx.config || {}
      if (!cookieOf(config)) {
        logger.warn?.('avamovie search skipped — no cookie')
        return []
      }
      const skip = Number(ctx.skip) || 0
      const page = Math.floor(skip / PAGE_SIZE) + 1
      const cacheKey = `ava-search:${q.toLowerCase()}:${page}`
      const hit = cache.get(cacheKey)
      if (Array.isArray(hit) && hit.length) return hit

      try {
        const path =
          page <= 1
            ? `/?s=${encodeURIComponent(q)}`
            : `/page/${page}/?s=${encodeURIComponent(q)}`
        const { html, base } = await fetchHtml(path, config, ctx.timeoutMs || 25_000)
        const parsed = parseSearchHtml(html, base)
        const items = mapItems(parsed)
        await enrichMissing(items, 12)
        cache.set(cacheKey, items, items.length ? CACHE_LIST_MS : CACHE_EMPTY_MS)
        logger.info?.('avamovie search', { q, page, count: items.length, base })
        return items
      } catch (err) {
        logger.warn?.('avamovie search failed', { message: err.message })
        return []
      }
    },

    async browseType(type, ctx = {}) {
      const path = type === 'series' ? '/series/' : '/movies/'
      return this._browsePath(path, type === 'series' ? 'series' : 'movie', ctx, `type:${type}`)
    },

    async browseGenre(type, genre, ctx = {}) {
      const config = ctx.config || {}
      if (!cookieOf(config)) return []
      const skip = Number(ctx.skip) || 0
      const page = Math.floor(skip / PAGE_SIZE) + 1
      const kind = type === 'series' ? 'series' : 'movie'
      const cacheKey = `ava-genre:${kind}:${genre}:${page}`
      const hit = cache.get(cacheKey)
      if (Array.isArray(hit) && hit.length) return hit
      try {
        const primary = thisBase(config)
        const listUrl = genreListUrl(primary, kind, genre, page)
        const path = listUrl.replace(primary, '')
        const { html, base } = await fetchHtml(path.startsWith('http') ? listUrl : path, config, ctx.timeoutMs || 25_000)
        const parsed = parseListingHtml(html, base, kind)
        const items = mapItems(parsed)
        await enrichMissing(items, 12)
        cache.set(cacheKey, items, items.length ? CACHE_LIST_MS : CACHE_EMPTY_MS)
        return items
      } catch (err) {
        logger.warn?.('avamovie genre failed', { message: err.message, genre })
        return []
      }
    },

    async browse(catalogId, ctx = {}) {
      const cat = getCatalogById(catalogId)
      if (!cat) return []
      return this._browsePath(cat.path, cat.type, ctx, catalogId)
    },

    async _browsePath(path, type, ctx = {}, catalogId = path) {
      const config = ctx.config || {}
      if (!cookieOf(config)) {
        logger.warn?.('avamovie browse skipped — no cookie', { catalogId })
        return []
      }
      const skip = Number(ctx.skip) || 0
      const page = Math.floor(skip / PAGE_SIZE) + 1
      const cacheKey = `ava-browse:${catalogId}:${page}`
      const hit = cache.get(cacheKey)
      if (Array.isArray(hit) && hit.length) return hit

      try {
        let listPath = path.startsWith('/') ? path : `/${path}`
        listPath = listPath.replace(/\/+$/, '') + '/'
        if (page > 1) listPath = `${listPath}page/${page}/`
        const { html, base, url } = await fetchHtml(listPath, config, ctx.timeoutMs || 25_000)

        if (/login-form|خرید اشتراک|buy-subscription/i.test(html) && !/item-movie/i.test(html)) {
          logger.warn?.('avamovie possible auth wall', { url, htmlLen: html.length })
        }

        let parsed = parseListingHtml(html, base, type)
        parsed = parsed.map((it) => ({ ...it, type: type || it.type }))
        const items = mapItems(parsed)
        await enrichMissing(items, 12)
        cache.set(cacheKey, items, items.length ? CACHE_LIST_MS : CACHE_EMPTY_MS)
        logger.info?.('avamovie browse', { catalogId, page, url, count: items.length })
        return items
      } catch (err) {
        logger.warn?.('avamovie browse failed', { message: err.message, catalogId })
        return []
      }
    },

    async getDetail(itemId, type, ctx = {}) {
      const pagePath = decodePageId(itemId)
      if (!pagePath) return null
      const config = ctx.config || {}
      if (!cookieOf(config)) {
        logger.warn?.('avamovie detail skipped — no cookie')
        return null
      }
      const cacheKey = `ava-detail:${pagePath}`
      const hit = cache.get(cacheKey)
      if (hit && (hit.streams?.length || hit.videos?.length)) return hit

      try {
        const { html, base } = await fetchHtml(`/${pagePath}`, config, ctx.timeoutMs || 25_000)
        const meta = parseDetailMeta(html, base)
        const streams = parseDetailStreams(html, base)

        const isSeries =
          type === 'series' ||
          meta.type === 'series' ||
          /\/series\//i.test(pagePath) ||
          streams.some((s) => s.episode != null)

        const episodes = isSeries ? buildSeriesVideos(streams) : []
        const videos = episodes.map((e) => ({
          season: e.season,
          episode: e.episode,
          title: e.title,
        }))

        let img = {}
        try {
          if (meta.imdb) {
            img = {
              imdb: meta.imdb,
              poster: metahubPoster(meta.imdb),
              background: metahubBackground(meta.imdb),
            }
          } else {
            img = await lookupImages(meta.title, meta.year, isSeries ? 'series' : 'movie')
          }
        } catch {
          img = {}
        }

        const imdb = meta.imdb || img.imdb
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
          description: img.description,
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
        logger.info?.('avamovie detail', {
          pagePath,
          type: detail.type,
          streams: streams.length,
          videos: videos.length,
        })
        return detail
      } catch (err) {
        logger.warn?.('avamovie detail failed', { message: err.message, itemId })
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
      const raw = item.internalId?.replace(/^cg:avamovie:/, '') || ''
      return toStremioProviderId('avamovie', raw)
    },
  }
}

function toStream(s) {
  return {
    url: s.url,
    name: s.badge || s.name || 'HD',
    title: s.label || s.title,
    quality: s.quality,
    providerKey: 'avamovie',
  }
}

function mapItems(parsed) {
  return (parsed || []).map((item) => ({
    internalId: makeInternalId('avamovie', item.itemId),
    type: item.type,
    title: item.title,
    year: item.year,
    poster: item.poster || undefined,
    providerKey: 'avamovie',
    externalRefs: { pagePath: item.pagePath },
  }))
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

export default createAvaMovieProvider
