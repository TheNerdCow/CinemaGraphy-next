/**
 * F2Media provider — clean-room adapter.
 */

import { makeInternalId, toStremioProviderId } from '../../core/ids/namespace.js'
import { createHttpClient } from '../../core/http/client.js'
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

export function createF2MediaProvider(deps = {}) {
  const http = deps.http || createHttpClient()
  const logger = deps.logger || console
  const cinemeta = deps.cinemeta || createCinemetaClient({ http })

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
      const url = `${base}/?s=${encodeURIComponent(q)}`
      try {
        const res = await http.get(url, {
          timeoutMs: ctx.timeoutMs || 15_000,
          headers: { 'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8' },
        })
        if (!res.ok) return []
        const html = await res.text()
        const parsed = parseSearchHtml(html, base)
        return enrichPosters(parsed, cinemeta)
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

      try {
        let parsed = []
        if (page === 1 && cat.homeRail) {
          const homeRes = await http.get(base + '/', {
            timeoutMs: ctx.timeoutMs || 15_000,
            headers: { 'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8' },
          })
          if (homeRes.ok) {
            parsed = parseHomeRail(await homeRes.text(), base, cat.homeRail)
          }
        }
        if (parsed.length === 0) {
          const url = catalogListUrl(base, cat, page)
          const res = await http.get(url, {
            timeoutMs: ctx.timeoutMs || 15_000,
            headers: { 'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8' },
          })
          if (!res.ok) return []
          parsed = parseListingHtml(await res.text(), base)
        }

        parsed = parsed.filter(
          (it) => it.type === cat.type || cat.id === 'f2media_coming_soon',
        )
        logger.info?.('f2media browse', { catalogId, page, count: parsed.length })
        return enrichPosters(parsed.slice(0, 24), cinemeta)
      } catch (err) {
        logger.warn?.('f2media browse failed', { message: err.message, catalogId })
        return []
      }
    },

    async getDetail(itemId, type, ctx = {}) {
      const pagePath = decodePageId(itemId)
      if (!pagePath) return null
      const base = this.baseUrl(ctx.config || {})
      const url = `${base}/${pagePath}`
      try {
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
          // flat streams still useful as fallback
          streams = episodes.flatMap((e) => e.streams)
        } else {
          streams = parseDetailStreams(html, base)
        }

        let enriched = null
        if (meta.imdb) {
          enriched = await cinemeta.byImdb(meta.imdb, isSeries ? 'series' : 'movie')
        }
        if (!enriched && meta.title) {
          const q = meta.year ? `${meta.title} ${meta.year}` : meta.title
          enriched = await cinemeta.search(q, isSeries ? 'series' : 'movie')
        }

        const imdb = meta.imdb || enriched?.imdb
        const poster = metahubPoster(imdb) || enriched?.poster || meta.poster
        const background = metahubBackground(imdb) || enriched?.background || poster

        return {
          id: itemId,
          pagePath,
          type: isSeries ? 'series' : 'movie',
          title: enriched?.name || meta.title,
          year: meta.year || (enriched?.year ? parseInt(String(enriched.year), 10) : undefined),
          imdb,
          poster,
          background,
          description: enriched?.description || meta.description,
          genres: enriched?.genres,
          imdbRating: enriched?.imdbRating,
          runtime: enriched?.runtime,
          streams,
          episodes,
          videos,
        }
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
        return ep.streams.map((s) => ({
          url: s.url,
          name: s.badge || 'HD',
          title: s.label,
          quality: s.quality,
          providerKey: 'f2media',
        }))
      }

      if (!detail?.streams?.length) return []
      return detail.streams.map((s) => ({
        url: s.url,
        name: s.badge || 'HD',
        title: s.label,
        quality: s.quality,
        providerKey: 'f2media',
      }))
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

async function enrichPosters(parsed, cinemeta) {
  return Promise.all(
    parsed.map(async (item) => {
      let poster = item.poster
      let imdb
      try {
        const q2 = item.year ? `${item.title} ${item.year}` : item.title
        const cm = await cinemeta.search(q2, item.type)
        if (cm?.imdb) {
          imdb = cm.imdb
          poster = metahubPoster(cm.imdb) || cm.poster || poster
        }
      } catch {
        /* ignore */
      }
      return {
        internalId: makeInternalId('f2media', item.itemId),
        type: item.type,
        title: item.title,
        year: item.year,
        poster,
        imdb,
        providerKey: 'f2media',
        externalRefs: { pagePath: item.pagePath },
      }
    }),
  )
}

export default createF2MediaProvider
