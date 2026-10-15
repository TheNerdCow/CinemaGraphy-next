/**
 * F2Media provider — clean-room adapter.
 * Site-first meta; Cinemeta only on strict title match; TTL cache.
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
const CACHE_LIST_MS = 8 * 60_000
const CACHE_DETAIL_MS = 15 * 60_000
const CACHE_HTML_MS = 6 * 60_000

export function createF2MediaProvider(deps = {}) {
  const http = deps.http || createHttpClient()
  const logger = deps.logger || console
  const cinemeta = deps.cinemeta || createCinemetaClient({ http })
  const cache = deps.cache || createMemoryCache(CACHE_LIST_MS)

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
      return cache.wrap(
        cacheKey,
        async () => {
          const url = `${base}/?s=${encodeURIComponent(q)}`
          const res = await http.get(url, {
            timeoutMs: ctx.timeoutMs || 15_000,
            headers: { 'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8' },
          })
          if (!res.ok) return []
          const html = await res.text()
          const parsed = parseSearchHtml(html, base)
          return mapItems(parsed)
        },
        CACHE_LIST_MS,
      )
    },

    async browse(catalogId, ctx = {}) {
      const cat = getCatalogById(catalogId)
      if (!cat) return []
      const base = this.baseUrl(ctx.config || {})
      const skip = Number(ctx.skip) || 0
      const page = Math.floor(skip / PAGE_SIZE) + 1
      const cacheKey = `browse:${base}:${catalogId}:${page}`

      return cache.wrap(
        cacheKey,
        async () => {
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
          logger.info?.('f2media browse', { catalogId, page, count: parsed.length })
          // Posters: only metahub when we already know imdb later; for list use site or skip slow search
          return mapItems(parsed.slice(0, 30))
        },
        CACHE_LIST_MS,
      )
    },

    async getDetail(itemId, type, ctx = {}) {
      const pagePath = decodePageId(itemId)
      if (!pagePath) return null
      const base = this.baseUrl(ctx.config || {})
      const cacheKey = `detail:${base}:${pagePath}`

      return cache.wrap(
        cacheKey,
        async () => {
          const url = `${base}/${pagePath}`
          const res = await http.get(url, { timeoutMs: ctx.timeoutMs || 15_000 })
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

          // Cinemeta only with STRICT match — never replace site title with wrong show
          let enriched = null
          if (meta.imdb) {
            const byId = await cinemeta.byImdb(meta.imdb, isSeries ? 'series' : 'movie')
            if (byId && isStrictTitleMatch(meta.title, byId.name, meta.year)) {
              enriched = byId
            } else if (byId && !meta.title) {
              enriched = byId
            }
          }
          if (!enriched && meta.title) {
            const q = meta.year ? `${meta.title} ${meta.year}` : meta.title
            const found = await cinemeta.search(q, isSeries ? 'series' : 'movie')
            if (found && isStrictTitleMatch(meta.title, found.name, meta.year)) {
              enriched = found
            }
          }

          const imdb = enriched?.imdb || meta.imdb
          // Prefer site title always as base; Cinemeta name only when strict match
          const title = meta.title || enriched?.name
          const poster =
            (imdb && metahubPoster(imdb)) || meta.poster || enriched?.poster
          const background =
            (imdb && metahubBackground(imdb)) || enriched?.background || poster
          const description =
            (enriched?.description && enriched.description.length > 40
              ? enriched.description
              : null) || meta.description

          return {
            id: itemId,
            pagePath,
            type: isSeries ? 'series' : 'movie',
            title,
            year: meta.year || (enriched?.year ? parseInt(String(enriched.year), 10) : undefined),
            imdb,
            poster,
            background,
            description,
            genres: enriched?.genres,
            imdbRating: enriched?.imdbRating,
            runtime: enriched?.runtime,
            streams,
            episodes,
            videos,
          }
        },
        CACHE_DETAIL_MS,
      )
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
    poster: item.poster,
    providerKey: 'f2media',
    externalRefs: { pagePath: item.pagePath },
  }))
}

async function fetchHtml(http, url, ctx, cache, cacheKey) {
  return cache.wrap(
    cacheKey,
    async () => {
      const res = await http.get(url, {
        timeoutMs: ctx.timeoutMs || 15_000,
        headers: { 'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8' },
      })
      if (!res.ok) return null
      return res.text()
    },
    CACHE_HTML_MS,
  )
}

export default createF2MediaProvider
