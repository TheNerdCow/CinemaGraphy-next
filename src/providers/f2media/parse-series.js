/**
 * Parse series seasons/episodes from F2Media detail pages.
 * Primary signal: CDN URLs with S01E01 pattern.
 */

import { analyzeMediaUrl, formatStreamLabel, qualityBadge } from './parse-streams-shared.js'

/**
 * @returns {{
 *   episodes: Array<{ season: number, episode: number, streams: object[] }>,
 *   videos: Array<{ season: number, episode: number, title: string }>
 * }}
 */
export function parseSeriesEpisodes(html, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  /** @type {Map<string, { season: number, episode: number, streams: object[] }>} */
  const map = new Map()

  const aRe = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
  let m
  while ((m = aRe.exec(html)) !== null) {
    const abs = resolveUrl(base, decodeHtml(m[1]))
    if (!abs || !isMediaUrl(abs)) continue

    const se = extractSeasonEpisode(abs, html, m.index)
    if (!se) continue

    const key = `${se.season}:${se.episode}`
    if (!map.has(key)) {
      map.set(key, { season: se.season, episode: se.episode, streams: [] })
    }
    const entry = map.get(key)
    if (entry.streams.some((s) => s.url === abs)) continue

    const fromUrl = analyzeMediaUrl(abs)
    // context window for dub/sub section
    const ctx = html.slice(Math.max(0, m.index - 500), m.index + 100)
    let audio = fromUrl.audio
    if (!audio) {
      if (/دوبله|dubbled|\/DUB\//i.test(ctx + abs)) audio = 'dub'
      else if (/زیرنویس|hardsub|\/SUB\//i.test(ctx + abs)) audio = 'sub'
    }
    const info = {
      ...fromUrl,
      audio,
      providerName: 'F2Media',
      providerEmoji: '🎬',
    }
    entry.streams.push({
      url: abs,
      ...info,
      label: formatStreamLabel(info),
      badge: qualityBadge(info.quality),
      season: se.season,
      episode: se.episode,
    })
  }

  const episodes = [...map.values()].sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season
    return a.episode - b.episode
  })

  // Rank streams inside each episode
  for (const ep of episodes) {
    ep.streams.sort((a, b) => {
      const qa = parseInt(String(a.quality || '').replace(/\D/g, ''), 10) || 0
      const qb = parseInt(String(b.quality || '').replace(/\D/g, ''), 10) || 0
      return qb - qa
    })
  }

  const videos = episodes.map((ep) => ({
    season: ep.season,
    episode: ep.episode,
    title: `فصل ${ep.season} - قسمت ${ep.episode}`,
  }))

  return { episodes, videos }
}

function extractSeasonEpisode(url, html, index) {
  const u = String(url)
  let m = u.match(/[Ss](\d+)[Ee](\d+)/)
  if (m) return { season: Number(m[1]), episode: Number(m[2]) }

  m = u.match(/[\/_-](\d{1,2})x(\d{1,3})[\/_\-.]/i)
  if (m) return { season: Number(m[1]), episode: Number(m[2]) }

  // Nearby Persian labels
  const ctx = html.slice(Math.max(0, index - 400), index + 50)
  const fa = ctx.match(/قسمت\s*(\d+)\s*فصل\s*(\d+)/)
  if (fa) return { season: Number(fa[2]), episode: Number(fa[1]) }
  const fa2 = ctx.match(/فصل\s*(\d+)[^\d]{0,12}قسمت\s*(\d+)/)
  if (fa2) return { season: Number(fa2[1]), episode: Number(fa2[2]) }

  return null
}

function isMediaUrl(abs) {
  try {
    const u = new URL(abs)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    if (/[?&]playit=/i.test(abs)) return false
    if (/\.(mp4|mkv|m3u8)(\?|$)/i.test(abs)) return true
    if (/\b(cdn|abrtech|dl|media)\b/i.test(u.hostname) && u.pathname.length > 12) return true
    return false
  } catch {
    return false
  }
}

function resolveUrl(base, href) {
  try {
    return new URL(href, base.endsWith('/') ? base : base + '/').toString()
  } catch {
    return null
  }
}

function decodeHtml(s) {
  return String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"')
}
