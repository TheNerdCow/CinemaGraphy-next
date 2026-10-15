/**
 * Cinemeta client — primary public metadata (no API key).
 * https://v3-cinemeta.strem.io
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

    /** Best-effort name search via Cinemeta catalog */
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

function normalize(meta) {
  if (!meta || !meta.id) return null
  return {
    imdb: meta.id,
    name: meta.name,
    nameFa: meta.name || undefined,
    type: meta.type,
    year: meta.releaseInfo || meta.year,
    poster: meta.poster,
    background: meta.background || meta.poster,
    description: meta.description,
    genres: meta.genres,
    runtime: meta.runtime,
    imdbRating: meta.imdbRating,
  }
}
