/**
 * F2Media provider — stream-first.
 * Posters: site HTML first, then Cinemeta/MetaHub only when missing (no API key).
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
import { extractPosterFromHtml } from './poster.js'
import {
  getCatalogById,
  toManifestCatalogs,
  catalogListUrl,
} from './catalogs.js'

const DEFAULT_BASE = 'https://www.myf2ms.top'
const MIRROR_BASES = [
  'https://www.myf2ms.top',
  'https://www.film2med.top',
  'https://film2med.top',
]
const PAGE_SIZE = 16
const CACHE_LIST_MS = 8 * 60_000
const CACHE_EMPTY_MS = 20_000
const CACHE_DETAIL_MS = 10 * 60_000
const CACHE_HTML_MS = 6 * 60_000
const CACHE_META_MS = 30 * 60_000

export function createF2MediaProvider(deps = {}) {
  const http = deps.http || createHttpClient({ maxConcurrent: 6, timeoutMs: 18_000 })
  const metaHttp = deps.metaHttp || createHttpClient({ maxConcurrent: 6, timeoutMs: 6_000 })
  const logger = deps.logger || console
  const cinemeta = deps.cinemeta || createCinemetaClient({ http: metaHttp })
  const cache = deps.cache || createMemoryCache(CACHE_LIST_MS)

  async function lookupImages(title, year, type) {
    if (!title) return {}
    const key = `meta:${type}:${title}:${year || ''}`
    const cached = cache.get(key)
    if (cached !== undefined) return cached

    const t = type === 'series' ? 'series' : 'movie'
    const out = {}

    try {
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
      /* metadata optional */
    }

    cache.set(key, out, CACHE_META_MS)
    return out
  }

  async function enrichListMissingPosters(items, limit = 16) {
    const need = items.filter((it) => !it.poster).slice(0, limit)
    await Promise.all(
      need.map(async (it) => {
        try {
          const img = await lookupImages(it.title, it.year, it.type)
          if (img.poster) it.poster = img.poster
          if (img.imdb) it.imdb = img.imdb
        } catch {
          /* keep without poster */
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
      if (Array.isArray(hit) && hit.length > 0) return hit

      try {
        const url = `${base}/?s=${encodeURIComponent(q)}`
        const res = await http.get(url, { timeoutMs: ctx.timeoutMs || 18_000 })
        if (!res.ok) {
          logger.warn?.('f2media search HTTP', { status: res.status, url })
          return []
        }
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
        await enrichListMissingPosters(items, 14)
        if (items.length) cache.set(cacheKey, items, CACHE_LIST_MS)
        else cache.set(cacheKey, items, CACHE_EMPTY_MS)
        logger.info?.('f2media search', { q, count: items.length })
        return items
      } catch (err) {
        logger.warn?.('f2media search failed', { message: err.message })
        return []
      }
    },

    async browse(catalogId, ctx = {}) {
      const cat = getCatalogById(catalogId)
      if (!cat) return []
      const primary = this.baseUrl(ctx.config || {})
      const skip = Number(ctx.skip) || 0
      const page = Math.floor(skip / PAGE_SIZE) + 1
      const cacheKey = `browse:${primary}:${catalogId}:${page}`
      const hit = cache.get(cacheKey)
      if (Array.isArray(hit) && hit.length > 0) return hit

      const bases = [primary, ...MIRROR_BASES.filter((b) => b !== primary)]

      try {
        let parsed = []
        let usedBase = primary
        let lastHtmlLen = 0

        for (const base of bases) {
          const listUrl = catalogListUrl(base, cat, page)
          const listHtml = await fetchHtml(http, listUrl, ctx, cache, `html:${listUrl}`)
          lastHtmlLen = listHtml ? listHtml.length : 0
          if (listHtml) {
            parsed = parseListingHtml(listHtml, base)
            logger.info?.('f2media browse try', {
              catalogId,
              listUrl,
              htmlLen: listHtml.length,
              parsed: parsed.length,
            })
          }
          if (parsed.length === 0 && page === 1) {
            const homeHtml = await fetchHtml(http, base + '/', ctx, cache, `html:${base}:home`)
            if (homeHtml) {
              lastHtmlLen = homeHtml.length
              parsed = cat.homeRail
                ? parseHomeRail(homeHtml, base, cat.homeRail)
                : parseListingHtml(homeHtml, base)
              logger.info?.('f2media browse home', {
                catalogId,
                base,
                htmlLen: homeHtml.length,
                parsed: parsed.length,
              })
            }
          }
          if (parsed.length > 0) {
            usedBase = base
            break
          }
        }

        parsed = parsed.map((it) => ({
          ...it,
          type: cat.type || it.type,
        }))

        const items = mapItems(parsed.slice(0, 24))
        await enrichListMissingPosters(items, 18)
        cache.set(
          cacheKey,
          items,
          items.length ? CACHE_LIST_MS : CACHE_EMPTY_MS,
        )
        logger.info?.('f2media browse', {
          catalogId,
          page,
          usedBase,
          count: items.length,
          lastHtmlLen,
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
        let res = await http.get(pageUrl, { timeoutMs: ctx.timeoutMs || 18_000 })
        if (!res.ok) {
          // try mirrors with same path
          for (const mirror of MIRROR_BASES) {
            if (mirror === base) continue
            res = await http.get(`${mirror}/${pagePath}`, {
              timeoutMs: ctx.timeoutMs || 15_000,
            })
            if (res.ok) break
          }
        }
        if (!res.ok) {
          logger.warn?.('detail HTTP', { status: res.status, pageUrl })
          return null
        }
        const html = await res.text()
        const meta = parseDetailMeta(html, base)
        const sitePoster =
          extractPosterFromHtml(html, base) || meta.poster || undefined

        const isSeries =
          type === 'series' ||
          /\/series\//i.test(pagePath) ||
          (meta.type === 'series' && /\/series\//i.test(pagePath))

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

        let img = {}
        try {
          if (meta.imdb) {
            img = {
              imdb: meta.imdb,
              poster: metahubPoster(meta.imdb),
              background: metahubBackground(meta.imdb),
            }
            const full = await withTimeout(
              cinemeta.byImdb(meta.imdb, isSeries ? 'series' : 'movie'),
              4000,
            )
            if (full) {
              img.description = full.description
              img.genres = full.genres
              img.imdbRating = full.imdbRating
              if (!img.poster) img.poster = full.poster
              if (!img.background) img.background = full.background
            }
          } else {
            img = await lookupImages(meta.title, meta.year, isSeries ? 'series' : 'movie')
          }
        } catch {
          img = {}
        }

        const imdb = meta.imdb || img.imdb
        const poster =
          (imdb && metahubPoster(imdb)) || img.poster || sitePoster || undefined
        const background =
          (imdb && metahubBackground(imdb)) || img.background || poster || sitePoster

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
    poster: item.poster || undefined,
    providerKey: 'f2media',
    externalRefs: { pagePath: item.pagePath },
  }))
}

async function fetchHtml(http, url, ctx, cache, cacheKey) {
  const hit = cache.get(cacheKey)
  if (typeof hit === 'string' && hit.length > 500) return hit
  try {
    const res = await http.get(url, { timeoutMs: ctx.timeoutMs || 18_000 })
    if (!res.ok) return null
    const text = await res.text()
    if (text && text.length > 500) cache.set(cacheKey, text, CACHE_HTML_MS)
    return text
  } catch {
    return null
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

export default createF2MediaProvider
