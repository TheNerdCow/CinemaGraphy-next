/**
 * F2Media provider — clean-room adapter.
 */

import { makeInternalId, toStremioProviderId } from '../../core/ids/namespace.js'
import { createHttpClient } from '../../core/http/client.js'
import { createCinemetaClient } from '../../core/meta/cinemeta.js'
import {
  parseSearchHtml,
  parseDetailStreams,
  parseDetailMeta,
  decodePageId,
} from './parse.js'

const DEFAULT_BASE = 'https://www.film2med.top'

export function createF2MediaProvider(deps = {}) {
  const http = deps.http || createHttpClient()
  const logger = deps.logger || console
  const cinemeta = deps.cinemeta || createCinemetaClient({ http })

  return {
    key: 'f2media',
    name: 'F2Media',
    capabilities: {
      search: true,
      browseCatalogs: [],
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
        if (!res.ok) {
          logger.warn?.('f2media search non-OK', { status: res.status, url })
          return []
        }
        const html = await res.text()
        const parsed = parseSearchHtml(html, base)
        logger.info?.('f2media search', { q, count: parsed.length })
        return parsed.map((item) => ({
          internalId: makeInternalId('f2media', item.itemId),
          type: item.type,
          title: item.title,
          year: item.year,
          poster: item.poster,
          providerKey: 'f2media',
          externalRefs: { pagePath: item.pagePath },
        }))
      } catch (err) {
        logger.warn?.('f2media search failed', { message: err.message })
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
        const streams = parseDetailStreams(html, base)

        // Cinemeta first for plot / poster / rating (site descriptions are SEO spam)
        let enriched = null
        if (meta.imdb) {
          enriched = await cinemeta.byImdb(meta.imdb, type || meta.type)
        }
        if (!enriched && meta.title) {
          const q = meta.year ? `${meta.title} ${meta.year}` : meta.title
          enriched = await cinemeta.search(q, type || meta.type)
        }

        return {
          id: itemId,
          pagePath,
          type: type || meta.type || enriched?.type || 'movie',
          title: enriched?.name || meta.title,
          year: meta.year || (enriched?.year ? parseInt(String(enriched.year), 10) : undefined),
          imdb: meta.imdb || enriched?.imdb,
          poster: enriched?.poster || meta.poster,
          background: enriched?.background || enriched?.poster || meta.poster,
          // Always prefer Cinemeta plot when present
          description: enriched?.description || meta.description,
          genres: enriched?.genres,
          imdbRating: enriched?.imdbRating,
          runtime: enriched?.runtime,
          streams,
        }
      } catch (err) {
        logger.warn?.('f2media detail failed', { message: err.message })
        return null
      }
    },

    async getStreams(detail) {
      if (!detail?.streams?.length) return []
      return detail.streams.map((s) => ({
        url: s.url,
        title: s.label,
        quality: s.quality,
        size: s.size,
        audio: s.audio,
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

export default createF2MediaProvider
