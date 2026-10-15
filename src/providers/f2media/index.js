/**
 * F2Media provider — posters only from Cinemeta/metahub (strict title match).
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
const CACHE_LIST_MS = 15 * 60_000
const CACHE_DETAIL_MS = 20 * 60_000
const CACHE_HTML_MS = 12 * 60_000
const CACHE_POSTER_MS = 24 * 60_000

export function createF2MediaProvider(deps = {}) {
  const http = deps.http || createHttpClient({ minGapMs: 120 })
  const logger = deps.logger || console
  const cinemeta = deps.cinemeta || createCinemetaClient({ http })
  const cache = deps.cache || createMemoryCache(CACHE_LIST_MS)

  async function resolvePoster(title, year, type) {
    if (!title) return { poster: undefined, imdb: undefined }
    const key = `poster:${type || 'movie'}:${title}:${year || ''}`
    return cache.wrap(
      key,
      async () => {
        try {
          const q = year ? `${title} ${year}` : title
          const found = await cinemeta.search(q, type === 'series' ? 'series' : 'movie')
          if (!found?.imdb) return { poster: undefined, imdb: undefined }
          if (!isStrictTitleMatch(title, found.name, year)) {
            return { poster: undefined, imdb: undefined }
          }
          return {
            poster: metahubPoster(found.imdb) || found.poster,
            imdb: found.imdb,
            background: metahubBackground(found.imdb) || found.background,
            description: found.description,
            genres: found.genres,
            imdbRating: found.imdbRating,
            runtime: found.runtime,
            name: found.name,
          }
        } catch {
          return { poster: undefined, imdb: undefined }
        }
      },
      CACHE_POSTER_MS,
    )
  }

  async function withCinemetaPosters(items) {
    // Limit concurrency to keep light
    const out = []
    const chunk = 4
    for (let i = 0; i < items.length; i += chunk) {
      const slice = items.slice(i, i + chunk)
      const part = await Promise.all(
        slice.map(async (it) => {
          const cm = await resolvePoster(it.title, it.year, it.type)
          return {
            ...it,
            poster: cm.poster,
            imdb: cm.imdb,
          }
        }),
      )
      out.push(...part)
    }
    return out
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
      return cache.wrap(
        `search:${base}:${q}`,
        async () => {
          const res = await http.get(`${base}/?s=${encodeURIComponent(q)}`, {
            timeoutMs: ctx.timeoutMs || 15_000,
          })
          if (!res.ok) return []
          const parsed = mapItems(parseSearchHtml(await res.text(), base))
          return withCinemetaPosters(parsed.slice(0, 20))
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

      return cache.wrap(
        `browse:${base}:${catalogId}:${page}`,
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
          const items = mapItems(parsed.slice(0, 24))
          const withPosters = await withCinemetaPosters(items)
          logger.info?.('f2media browse', {
            catalogId,
            page,
            count: withPosters.length,
            withPoster: withPosters.filter((p) => p.poster).length,
          })
          return withPosters
        },
        CACHE_LIST_MS,
      )
    },

    async getDetail(itemId, type, ctx = {}) {
      const pagePath = decodePageId(itemId)
      if (!pagePath) return null
      const base = this.baseUrl(ctx.config || {})

      return cache.wrap(
        `detail:${base}:${pagePath}`,
        async () => {
          const res = await http.get(`${base}/${pagePath}`, {
            timeoutMs: ctx.timeoutMs || 15_000,
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

          // Cinemeta for poster + optional plot — strict match only; never replace wrong title
          let cm = null
          if (meta.imdb) {
            const byId = await cinemeta.byImdb(meta.imdb, isSeries ? 'series' : 'movie')
            if (byId && (!meta.title || isStrictTitleMatch(meta.title, byId.name, meta.year))) {
              cm = byId
            }
          }
          if (!cm && meta.title) {
            cm = await resolvePoster(meta.title, meta.year, isSeries ? 'series' : 'movie')
            // resolvePoster returns partial; normalize
            if (cm && !cm.name && cm.imdb) {
              const full = await cinemeta.byImdb(cm.imdb, isSeries ? 'series' : 'movie')
              if (full) cm = { ...cm, ...full }
            }
          }

          const imdb = cm?.imdb || meta.imdb
          const poster = (imdb && metahubPoster(imdb)) || cm?.poster
          const background =
            (imdb && metahubBackground(imdb)) || cm?.background || poster

          return {
            id: itemId,
            pagePath,
            type: isSeries ? 'series' : 'movie',
            title: meta.title || cm?.name,
            year: meta.year || (cm?.year ? parseInt(String(cm.year), 10) : undefined),
            imdb,
            poster,
            background,
            description:
              (cm?.description && String(cm.description).length > 40 ? cm.description : null) ||
              meta.description,
            genres: cm?.genres,
            imdbRating: cm?.imdbRating,
            runtime: cm?.runtime,
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
    poster: undefined,
    providerKey: 'f2media',
    externalRefs: { pagePath: item.pagePath },
  }))
}

async function fetchHtml(http, url, ctx, cache, cacheKey) {
  return cache.wrap(
    cacheKey,
    async () => {
      const res = await http.get(url, { timeoutMs: ctx.timeoutMs || 15_000 })
      if (!res.ok) return null
      return res.text()
    },
    CACHE_HTML_MS,
  )
}

export default createF2MediaProvider
