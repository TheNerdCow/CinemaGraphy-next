/**
 * DigiMovie provider — subscription / cookie session.
 * Domain rotates (digimoviez53.top, digimoviez.com, …) → baseUrl is configurable.
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

const DEFAULT_BASE = 'https://digimoviez53.top'
const MIRROR_BASES = [
  'https://digimoviez53.top',
  'https://www.digimoviez.com',
  'https://digimoviez.com',
]
const PAGE_SIZE = 24
const CACHE_LIST_MS = 8 * 60_000
const CACHE_EMPTY_MS = 8_000
const CACHE_DETAIL_MS = 10 * 60_000
const CACHE_META_MS = 30 * 60_000

export function createDigiMovieProvider(deps = {}) {
  const http = deps.http || createHttpClient({ maxConcurrent: 4, timeoutMs: 22_000 })
  const metaHttp = deps.metaHttp || createHttpClient({ maxConcurrent: 4, timeoutMs: 6_000 })
  const logger = deps.logger || console
  const cinemeta = deps.cinemeta || createCinemetaClient({ http: metaHttp })
  const cache = deps.cache || createMemoryCache(CACHE_LIST_MS)

  function cookieOf(config) {
    const fromConfig = config?.providers?.digimovie?.cookie
    const fromEnv = process.env.DIGIMOVIE_COOKIE
    return String(fromConfig || fromEnv || '').trim()
  }

  function thisBase(config) {
    const fromConfig = config?.providers?.digimovie?.baseUrl
    const fromEnv = process.env.DIGIMOVIE_BASEURL
    const raw = (fromConfig || fromEnv || DEFAULT_BASE).trim()
    return raw.replace(/\/+$/, '') || DEFAULT_BASE
  }

  function authHeaders(config, base) {
    const cookie = cookieOf(config)
    if (!cookie) return {}
    return {
      Cookie: cookie,
      Referer: `${base || thisBase(config)}/`,
      Origin: base || thisBase(config),
    }
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

  function isUsefulHtml(html, kind = 'list') {
    if (!html || html.length < 600) return false
    if (kind === 'list' || kind === 'search') {
      if (/<article|post-|movie-|item-|entry-title|archive/i.test(html)) return true
      if (/digimoviez|دیجی\s*مووی/i.test(html) && /href=/i.test(html)) return true
      return false
    }
    if (/\.mkv|\.mp4|download|دانلود/i.test(html)) return true
    if (/og:title/i.test(html)) return true
    return false
  }

  async function fetchHtml(pathOrUrl, config, timeoutMs, kind = 'list') {
    const bases = candidateBases(config)
    const attempts = []
    let lastErr = null

    for (const base of bases) {
      const url = pathOrUrl.startsWith('http')
        ? pathOrUrl.replace(/^https?:\/\/[^/]+/i, base)
        : `${base}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`

      try {
        const res = await http.get(url, {
          timeoutMs: timeoutMs || 22_000,
          headers: authHeaders(config, base),
        })
        if (!res.ok) {
          attempts.push({ base, url, status: res.status, reason: 'http' })
          lastErr = new Error(`HTTP ${res.status} ${url}`)
          continue
        }
        const html = await res.text()
        const useful = isUsefulHtml(html, kind)
        attempts.push({
          base,
          url,
          status: res.status,
          htmlLen: html.length,
          useful,
        })
        if (!useful) {
          lastErr = new Error(`useless body on ${base}`)
          continue
        }
        return { html, base, url, status: res.status, attempts }
      } catch (err) {
        attempts.push({ base, url, error: err.message })
        lastErr = err
        logger.warn?.('digimovie fetch failed', { url, message: err.message })
      }
    }

    const err = lastErr || new Error('digimovie unreachable')
    err.attempts = attempts
    throw err
  }

  async function lookupImages(title, year, type) {
    if (!title) return {}
    const clean = String(title).replace(/\s+/g, ' ').trim()
    if (!clean) return {}
    const key = `digi-meta:${type}:${clean.toLowerCase()}:${year || ''}`
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const out = {}
    try {
      const t = type === 'series' ? 'series' : 'movie'
      const queries = year ? [`${clean} ${year}`, clean] : [clean]
      for (const q of queries) {
        const found = await withTimeout(cinemeta.search(q, t), 5000)
        if (found?.imdb) {
          out.poster = metahubPoster(found.imdb) || found.poster
          out.background = metahubBackground(found.imdb) || found.background || out.poster
          out.imdb = found.imdb
          out.description = found.description
          out.genres = found.genres
          out.imdbRating = found.imdbRating
          break
        }
      }
    } catch {
      /* optional */
    }
    cache.set(key, out, CACHE_META_MS)
    return out
  }

  async function enrichListMissingPosters(items, limit = 18) {
    const need = (items || []).filter((it) => !it.poster).slice(0, limit)
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
    key: 'digimovie',
    name: 'DigiMovie',
    capabilities: {
      search: true,
      browseCatalogs: toManifestCatalogs(),
      streams: true,
      providerMeta: true,
      auth: 'cookie',
    },

    isEnabled(config) {
      const p = config.providers?.digimovie
      if (p?.enabled === false) return false
      if (!cookieOf(config) && p?.enabled !== true) return false
      if (config.providersEnabled?.length) {
        return config.providersEnabled.includes('digimovie')
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
        logger.warn?.('digimovie search skipped — no cookie')
        return []
      }
      const skip = Number(ctx.skip) || 0
      const page = Math.floor(skip / PAGE_SIZE) + 1
      const cacheKey = `digi-search:${q.toLowerCase()}:${page}`
      const hit = cache.get(cacheKey)
      if (Array.isArray(hit) && hit.length) return hit

      try {
        const path =
          page <= 1
            ? `/?s=${encodeURIComponent(q)}`
            : `/page/${page}/?s=${encodeURIComponent(q)}`
        const { html, base } = await fetchHtml(path, config, ctx.timeoutMs || 22_000, 'search')
        const items = mapItems(parseSearchHtml(html, base))
        await enrichListMissingPosters(items, 18)
        cache.set(cacheKey, items, items.length ? CACHE_LIST_MS : CACHE_EMPTY_MS)
        logger.info?.('digimovie search', { q, page, count: items.length, base })
        return items
      } catch (err) {
        logger.warn?.('digimovie search failed', {
          message: err.message,
          attempts: err.attempts,
        })
        return []
      }
    },

    async browseType(type, ctx = {}) {
      const path = type === 'series' ? '/series/' : '/movies/'
      return this._browsePath(path, type === 'series' ? 'series' : 'movie', ctx, `type:${type}`)
    },

    async browse(catalogId, ctx = {}) {
      const cat = getCatalogById(catalogId)
      if (!cat) return []
      return this._browsePath(cat.path, cat.type, ctx, catalogId)
    },

    async _browsePath(path, type, ctx = {}, catalogId = path) {
      const config = ctx.config || {}
      if (!cookieOf(config)) {
        logger.warn?.('digimovie browse skipped — no cookie', { catalogId })
        return []
      }
      const skip = Number(ctx.skip) || 0
      const page = Math.floor(skip / PAGE_SIZE) + 1
      const cacheKey = `digi-browse:${catalogId}:${page}`
      const hit = cache.get(cacheKey)
      if (Array.isArray(hit) && hit.length) return hit

      try {
        const dummy = 'https://host.invalid'
        const full =
          catalogId.startsWith('digimovie_') && getCatalogById(catalogId)
            ? catalogListUrl(dummy, getCatalogById(catalogId), page)
            : null
        let listPath
        if (full) {
          listPath = full.replace(dummy, '')
        } else {
          listPath = path.startsWith('/') ? path : `/${path}`
          if (!listPath.endsWith('/')) listPath += '/'
          if (page > 1) listPath = `${listPath.replace(/\/+$/, '')}/page/${page}/`
        }

        const { html, base, url } = await fetchHtml(
          listPath,
          config,
          ctx.timeoutMs || 22_000,
          'list',
        )

        let parsed = parseListingHtml(html, base, type)
        parsed = parsed.map((it) => ({ ...it, type: type || it.type }))
        const items = mapItems(parsed)
        await enrichListMissingPosters(items, 18)
        cache.set(cacheKey, items, items.length ? CACHE_LIST_MS : CACHE_EMPTY_MS)
        logger.info?.('digimovie browse', {
          catalogId,
          page,
          url,
          base,
          count: items.length,
          withPoster: items.filter((i) => i.poster).length,
        })
        return items
      } catch (err) {
        logger.warn?.('digimovie browse failed', {
          message: err.message,
          catalogId,
          attempts: err.attempts,
        })
        return []
      }
    },

    async getDetail(itemId, type, ctx = {}) {
      const pagePath = decodePageId(itemId)
      if (!pagePath) return null
      const config = ctx.config || {}
      if (!cookieOf(config)) {
        logger.warn?.('digimovie detail skipped — no cookie')
        return null
      }
      const cacheKey = `digi-detail:${pagePath}`
      const hit = cache.get(cacheKey)
      if (hit && (hit.streams?.length || hit.videos?.length)) return hit

      try {
        const { html, base } = await fetchHtml(
          `/${pagePath}`,
          config,
          ctx.timeoutMs || 22_000,
          'detail',
        )
        const meta = parseDetailMeta(html, base)
        const streams = parseDetailStreams(html, base)

        const isSeries =
          type === 'series' ||
          meta.type === 'series' ||
          /^serie\//i.test(pagePath) ||
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
        logger.info?.('digimovie detail', {
          pagePath,
          type: detail.type,
          streams: streams.length,
          videos: videos.length,
        })
        return detail
      } catch (err) {
        logger.warn?.('digimovie detail failed', {
          message: err.message,
          itemId,
          attempts: err.attempts,
        })
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
      const raw = item.internalId?.replace(/^cg:digimovie:/, '') || ''
      return toStremioProviderId('digimovie', raw)
    },
  }
}

function toStream(s) {
  return {
    url: s.url,
    name: s.badge || s.name || 'HD',
    title: s.label || s.title,
    quality: s.quality,
    providerKey: 'digimovie',
  }
}

function mapItems(parsed) {
  return (parsed || []).map((item) => ({
    internalId: makeInternalId('digimovie', item.itemId),
    type: item.type,
    title: item.title,
    year: item.year,
    poster: item.poster || undefined,
    providerKey: 'digimovie',
    externalRefs: { pagePath: item.pagePath },
  }))
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

export default createDigiMovieProvider
