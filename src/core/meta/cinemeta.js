/**
 * Cinemeta client — primary public metadata (no API key).
 * Posters via images.metahub.space (works better than IR-blocked site CDNs).
 */

import { createHttpClient } from '../http/client.js'

const BASE = 'https://v3-cinemeta.strem.io'

export function createCinemetaClient(deps = {}) {
  const http = deps.http || createHttpClient()

  return {
    async byImdb(imdbId, type = 'movie') {
      const id = String(imdbId || '').trim()
      if (!/^tt\d+$/i.test(id)) return null
      const t = type === 'series' ? 'series' : 'movie'
      try {
        const res = await http.get(`${BASE}/meta/${t}/${id}.json`, { timeoutMs: 8_000 })
        if (!res.ok) return null
        const data = await res.json()
        return normalize(data?.meta)
      } catch {
        return null
      }
    },

    async search(query, type = 'movie') {
      const q = String(query || '').trim()
      if (!q) return null
      const t = type === 'series' ? 'series' : 'movie'
      try {
        const url = `${BASE}/catalog/${t}/top/search=${encodeURIComponent(q)}.json`
        const res = await http.get(url, { timeoutMs: 8_000 })
        if (!res.ok) return null
        const data = await res.json()
        const first = data?.metas?.[0]
        if (!first?.id) return null
        return this.byImdb(first.id, t)
      } catch {
        return null
      }
    },
  }
}

/** Prefer medium posters from metahub */
export function upgradePosterUrl(url, imdbId) {
  if (imdbId && /^tt\d+$/i.test(imdbId)) {
    return `https://images.metahub.space/poster/medium/${imdbId}/img`
  }
  if (!url) return undefined
  return String(url).replace('/poster/small/', '/poster/medium/')
}

export function metahubPoster(imdbId, size = 'medium') {
  if (!imdbId || !/^tt\d+$/i.test(imdbId)) return undefined
  return `https://images.metahub.space/poster/${size}/${imdbId}/img`
}

export function metahubBackground(imdbId) {
  if (!imdbId || !/^tt\d+$/i.test(imdbId)) return undefined
  return `https://images.metahub.space/background/medium/${imdbId}/img`
}

function normalize(meta) {
  if (!meta || !meta.id) return null
  const imdb = meta.id
  return {
    imdb,
    name: meta.name,
    type: meta.type,
    year: meta.releaseInfo || meta.year,
    poster: metahubPoster(imdb, 'medium') || meta.poster,
    background: metahubBackground(imdb) || meta.background || meta.poster,
    description: meta.description,
    genres: meta.genres || meta.genre,
    runtime: meta.runtime,
    imdbRating: meta.imdbRating,
    moviedbId: meta.moviedb_id,
  }
}
