/**
 * Optional TMDB client — only when TMDB_API_KEY is set.
 * Free key: https://www.themoviedb.org/settings/api
 */

import { createHttpClient } from '../http/client.js'

const API = 'https://api.themoviedb.org/3'
const IMG = 'https://image.tmdb.org/t/p'

export function createTmdbClient(deps = {}) {
  const key =
    deps.apiKey ||
    process.env.TMDB_API_KEY ||
    process.env.TMDB_KEY ||
    ''
  const http = deps.http || createHttpClient({ maxConcurrent: 4, timeoutMs: 5_000 })

  if (!key) {
    return {
      enabled: false,
      async search() {
        return null
      },
      async byImdb() {
        return null
      },
    }
  }

  async function get(path, params = {}) {
    const u = new URL(API + path)
    u.searchParams.set('api_key', key)
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') u.searchParams.set(k, String(v))
    }
    const res = await http.get(u.toString(), { timeoutMs: 5_000 })
    if (!res.ok) return null
    return res.json()
  }

  return {
    enabled: true,

    async search(query, type = 'movie') {
      const q = String(query || '').trim()
      if (!q) return null
      try {
        const media = type === 'series' ? 'tv' : 'movie'
        const data = await get(`/search/${media}`, { query: q, include_adult: 'false' })
        const first = data?.results?.[0]
        if (!first?.id) return null
        return normalizeTmdb(first, media)
      } catch {
        return null
      }
    },

    async byImdb(imdbId, type = 'movie') {
      const id = String(imdbId || '').trim()
      if (!/^tt\d+$/i.test(id)) return null
      try {
        const media = type === 'series' ? 'tv' : 'movie'
        // find TMDB id via find endpoint
        const found = await get(`/find/${id}`, { external_source: 'imdb_id' })
        const row =
          media === 'tv'
            ? found?.tv_results?.[0]
            : found?.movie_results?.[0]
        if (!row?.id) return null
        const detail = await get(`/${media}/${row.id}`)
        return normalizeTmdb(detail || row, media, id)
      } catch {
        return null
      }
    },
  }
}

function normalizeTmdb(row, media, imdb) {
  if (!row) return null
  const title = row.title || row.name
  const year = String(row.release_date || row.first_air_date || '').slice(0, 4)
  const poster = row.poster_path ? `${IMG}/w500${row.poster_path}` : undefined
  const background = row.backdrop_path
    ? `${IMG}/w1280${row.backdrop_path}`
    : poster
  return {
    imdb: imdb || undefined,
    tmdbId: row.id,
    name: title,
    type: media === 'tv' ? 'series' : 'movie',
    year: year || undefined,
    poster,
    background,
    description: row.overview || undefined,
    genres: Array.isArray(row.genres) ? row.genres.map((g) => g.name) : undefined,
    imdbRating: row.vote_average ? String(row.vote_average) : undefined,
    source: 'tmdb',
  }
}

export function tmdbPoster(path, size = 'w500') {
  if (!path) return undefined
  if (String(path).startsWith('http')) return path
  return `${IMG}/${size}${path}`
}
