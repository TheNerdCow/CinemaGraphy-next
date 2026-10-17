/**
 * AvaMovie provider — subscription / cookie session.
 *
 * Inside Iran: avadel.top is reachable; avamovie.shop is often filtered.
 * Outside Iran: avadel.top may timeout; avamovie.shop works via Cloudflare.
 *
 * Strategy: try preferred base first, but only accept HTML that looks like a
 * real listing/detail (has item-movie / downloadbox / title_en). Filtered or
 * soft-block pages are skipped and the next mirror is tried.
 *
 * Posters: prefer Cinemeta → images.metahub.space (no auth). Site CDN posters
 * often need session cookies and fail inside Stremio/Nuvio image loaders.
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
  genreListUrl,
  AVA_MOVIE_GENRES,
  AVA_SERIES_GENRES,
} from './catalogs.js'

/** Primary for IR users (unfiltered). */
const DEFAULT_BASE = 'https://avadel.top'
/** Fallback for outside IR / when primary fails. */
const MIRROR_BASES = ['https://avadel.top', 'https://avamovie.shop']
const PAGE_SIZE = 24
const CACHE_LIST_MS = 8 * 60_000
const CACHE_EMPTY_MS = 8_000
const CACHE_DETAIL_MS = 10 * 60_000
const CACHE_META_MS = 30 * 60_000

export function createAvaMovieProvider(deps = {}) {
  const http = deps.http || createHttpClient({ maxConcurrent: 4, timeoutMs: 22_000 })
  const metaHttp = deps.metaHttp || createHttpClient({ maxConcurrent: 4, timeoutMs: 6_000 })
  const logger = deps.logger || console
  const cinemeta = deps.cinemeta || createCinemetaClient({ http: metaHttp })
  const cache = deps.cache || createMemoryCache(CACHE_LIST_MS)

  function cookieOf(config) {
    const fromConfig = config?.providers?.avamovie?.cookie
    const fromEnv = process.env.AVAMOVIE_COOKIE
    return String(fromConfig || fromEnv || '').trim()
  }

  function thisBase(config) {
    const fromConfig = config?.providers?.avamovie?.baseUrl
    const fromEnv = process.env.AVAMOVIE_BASEURL
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

  /** True if HTML looks like real AvaMovie content, not a filter/login shell. */
  function isUsefulHtml(html, kind = 'list') {
    if (!html || html.length < 800) return false
    const h = html
    if (kind === 'list' || kind === 'search') {
      if (/item-movie/i.test(h) || /class="[^"]*title_en[^"]*"/i.test(h)) return true
      if (/archive-posts/i.test(h) && /title_en/i.test(h)) return true
      return false
    }
    if (/downloadbox|dl-item|link-main/i.test(h)) return true
    if (/yserver|\.mkv|\.mp4/i.test(h)) return true
    if (/og:title/i.test(h) && /avadel|avamovie/i.test(h)) return true
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
          logger.warn?.('avamovie HTTP', { status: res.status, url })
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
          itemMovie: (html.match(/item-movie/gi) || []).length,
        })
        if (!useful) {
          lastErr = new Error(`useless body on ${base} (filter/login?)`)
          logger.warn?.('avamovie skip non-content host', {
            base,
            url,
            htmlLen: html.length,
          })
          continue
        }
        return { html, base, url, status: res.status, attempts }
      } catch (err) {
        attempts.push({ base, url, error: err.message })
        lastErr = err
        logger.warn?.('avamovie fetch failed', { url, message: err.message })
      }
    }

    const err = lastErr || new Error('avamovie unreachable')
    err.attempts = attempts
    throw err
  }

  async function lookupImages(title, year, type) {
    if (!title) return {}
    const clean = String(title)
      .replace(/دانلود\s*(فیلم|سریال|انیمیشن|انیمه)?/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!clean) return {}

    const key = `ava-meta:${type}:${clean.toLowerCase()}:${year || ''}`
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const out = {}
    try {
      const t = type === 'series' ? 'series' : 'movie'
      // Try with year, then without (Ava year field is often episode text)
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
      // series missed? try movie catalog (anime films)
      if (!out.imdb && t === 'series') {
        const found = await withTimeout(cinemeta.search(clean, 'movie'), 4000)
        if (found?.imdb) {
          out.poster = metahubPoster(found.imdb) || found.poster
          out.background = metahubBackground(found.imdb) || found.background || out.poster
          out.imdb = found.imdb
        }
      }
    } catch {
      /* optional */
    }
    cache.set(key, out, CACHE_META_MS)
    return out
  }

  /**
   * Prefer public Metahub posters. Site CDN (avadel.top/cdn/...) often requires
   * the same session cookie and fails in Stremio's image proxy.
   */
  async function enrichPosters(items, limit = 24) {
    const batch = (items || []).slice(0, limit)
    await Promise.all(
      batch.map(async (it) => {
        try {
          const img = await lookupImages(it.title, it.year, it.type)
          if (img.poster) {
            it.poster = img.poster
            if (img.background) it.background = img.background
          }
          // keep site poster only if Cinemeta failed
          if (img.imdb) it.imdb = img.imdb
          if (img.description) it.description = img.description
        } catch {
          /* keep site poster if any */
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
        const { html, base } = await fetchHtml(path, config, ctx.timeoutMs || 22_000, 'search')
        const parsed = parseSearchHtml(html, base)
        const items = mapItems(parsed)
        await enrichPosters(items, 24)
        cache.set(cacheKey, items, items.length ? CACHE_LIST_MS : CACHE_EMPTY_MS)
        logger.info?.('avamovie search', { q, page, count: items.length, base })
        return items
      } catch (err) {
        logger.warn?.('avamovie search failed', {
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
        const dummy = 'https://host.invalid'
        const full = genreListUrl(dummy, kind, genre, page)
        const path = full.replace(dummy, '')
        const { html, base } = await fetchHtml(path, config, ctx.timeoutMs || 22_000, 'list')
        const parsed = parseListingHtml(html, base, kind)
        const items = mapItems(parsed)
        await enrichPosters(items, 24)
        cache.set(cacheKey, items, items.length ? CACHE_LIST_MS : CACHE_EMPTY_MS)
        return items
      } catch (err) {
        logger.warn?.('avamovie genre failed', {
          message: err.message,
          genre,
          attempts: err.attempts,
        })
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
        const { html, base, url } = await fetchHtml(
          listPath,
          config,
          ctx.timeoutMs || 22_000,
          'list',
        )

        if (/login-form|خرید اشتراک|buy-subscription/i.test(html) && !/item-movie/i.test(html)) {
          logger.warn?.('avamovie possible auth wall', { url, htmlLen: html.length })
        }

        let parsed = parseListingHtml(html, base, type)
        parsed = parsed.map((it) => ({ ...it, type: type || it.type }))
        const items = mapItems(parsed)
        await enrichPosters(items, 24)
        cache.set(cacheKey, items, items.length ? CACHE_LIST_MS : CACHE_EMPTY_MS)
        const withPoster = items.filter((i) => i.poster).length
        logger.info?.('avamovie browse', {
          catalogId,
          page,
          url,
          base,
          count: items.length,
          withPoster,
        })
        return items
      } catch (err) {
        logger.warn?.('avamovie browse failed', {
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
        logger.warn?.('avamovie detail skipped — no cookie')
        return null
      }
      const cacheKey = `ava-detail:${pagePath}`
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
        // Prefer public metahub; site og:image may need auth
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
          hasPoster: Boolean(poster),
        })
        return detail
      } catch (err) {
        logger.warn?.('avamovie detail failed', {
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
    // site poster kept as temporary fallback; enrichPosters may replace
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
