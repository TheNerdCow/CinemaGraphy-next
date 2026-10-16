/**
 * Cinamatic (cinamatic.top) HTML parsers.
 * Paths look like /2026/10/16/slug/ — WordPress date permalinks.
 */

import {
  qualityBadge,
  formatStreamLabel,
  analyzeMediaUrl,
  extractQuality,
} from '../f2media/parse-streams-shared.js'

export function encodePageId(pagePath) {
  return Buffer.from(String(pagePath), 'utf8').toString('base64url')
}

export function decodePageId(itemId) {
  try {
    const raw = String(itemId || '')
    if (!/^[A-Za-z0-9_-]+$/.test(raw)) return null
    const p = Buffer.from(raw, 'base64url').toString('utf8')
    if (!p || p.includes('..') || p.includes('://')) return null
    return p.replace(/^\/+/, '')
  } catch {
    return null
  }
}

export function parseListingHtml(html, baseUrl, forceType) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const results = []
  const seen = new Set()

  // Primary: title links to /YYYY/MM/DD/slug/
  const linkRe =
    /<a[^>]+href=["'](https?:\/\/[^"']+|\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = linkRe.exec(html)) !== null) {
    const abs = resolveUrl(base, m[1])
    if (!abs || !isContentUrl(abs, base)) continue
    const pagePath = pathFromUrl(abs, base)
    if (!pagePath || seen.has(pagePath)) continue

    let title = cleanTitle(stripTags(m[2]))
    if (!title || title.length < 2) {
      title = cleanTitle(
        match1(m[0], /title=["']([^"']+)["']/i) ||
          match1(
            html.slice(Math.max(0, m.index - 100), m.index + 400),
            /<h[12][^>]*>([\s\S]*?)<\/h[12]>/i,
          ) ||
          '',
      )
    }
    if (!title || title.length < 2) continue
    if (/^(ادامه|دانلود|مشاهده|تریلر|ورود|عضویت)$/i.test(title)) continue

    const window = html.slice(Math.max(0, m.index - 800), m.index + 1200)
    const poster = extractPoster(window, base)
    const year = extractYear(title) || extractYear(window)
    const type =
      forceType ||
      (/\/category\/(series|anime)/i.test(window) || /سریال|فصل|قسمت/i.test(window)
        ? 'series'
        : 'movie')

    seen.add(pagePath)
    results.push({
      itemId: encodePageId(pagePath),
      title,
      year: year || undefined,
      type,
      poster: poster || undefined,
      pagePath,
    })
    if (results.length >= 40) break
  }

  return results
}

export function parseSearchHtml(html, baseUrl) {
  return parseListingHtml(html, baseUrl, null)
}

export function parseDetailMeta(html, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const title =
    match1(html, /property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
    match1(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const clean = title ? cleanTitle(stripTags(title)) : undefined
  const year = clean ? extractYear(clean) : extractYear(html.slice(0, 15000))
  const poster =
    match1(html, /property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
    match1(html, /"thumbnailUrl"\s*:\s*"(https?:[^"\\]+)"/i)
  let description = match1(html, /خلاصه\s*داستان\s*:?[\s\S]{0,20}?([\s\S]{40,800}?)(?:<|$)/i)
  if (description) description = stripTags(description).slice(0, 1200)

  const isSeries =
    /فصل\s*\d+|قسمت\s*\d+|season|episode/i.test(html.slice(0, 25000))

  return {
    title: clean,
    year: year || undefined,
    type: isSeries ? 'series' : 'movie',
    poster: poster ? resolveUrl(base, poster) : undefined,
    description: description || undefined,
  }
}

/** Movie + series stream links from detail page. */
export function parseDetailStreams(html, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const out = []
  const seen = new Set()

  const aRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let am
  while ((am = aRe.exec(html)) !== null) {
    const href = decodeHtml(am[1])
    const abs = resolveUrl(base, href)
    if (!abs || !isPlayableUrl(abs)) continue
    if (seen.has(abs)) continue
    // skip pure trailers folder if labeled trailer only
    const text = stripTags(am[2] || '')
    if (/تریلر|trailer/i.test(text) && /trailers\//i.test(abs)) continue
    seen.add(abs)

    const local = html.slice(Math.max(0, am.index - 350), am.index + am[0].length + 60)
    const localText = stripTags(local) + ' ' + text
    const fromUrl = analyzeMediaUrl(abs)
    const quality = fromUrl.quality || extractQuality(localText) || extractQuality(text)
    const size = extractSize(localText) || extractSize(text)
    let audio = fromUrl.audio
    if (!audio) {
      if (/دوبله/i.test(localText)) audio = 'dub'
      else if (/زیرنویس/i.test(localText)) audio = 'sub'
    }
    const codec =
      fromUrl.codec || (/x265|HEVC/i.test(localText) ? 'x265' : /x264/i.test(localText) ? 'x264' : null)

    const seasonEp = extractSeasonEpisode(localText)
    const info = {
      quality,
      size,
      audio,
      source: fromUrl.source,
      codec,
      hdr: fromUrl.hdr,
      bit10: fromUrl.bit10,
      providerName: 'Cinamatic',
      providerEmoji: '🎞️',
      season: seasonEp.season,
      episode: seasonEp.episode,
    }
    out.push({
      url: abs,
      ...info,
      label: formatStreamLabel(info),
      badge: qualityBadge(quality),
    })
  }

  const rank = (s) => {
    const q = parseInt(String(s.quality || '').replace(/\D/g, ''), 10) || 0
    return q + (s.audio === 'dub' ? 5 : 0)
  }
  out.sort((a, b) => rank(b) - rank(a))
  return out
}

/** Build Stremio videos list from stream season/episode tags. */
export function buildSeriesVideos(streams) {
  const map = new Map()
  for (const s of streams) {
    const season = Number(s.season) || 1
    const episode = Number(s.episode)
    if (!episode) continue
    const key = `${season}:${episode}`
    if (!map.has(key)) {
      map.set(key, {
        season,
        episode,
        title: `S${season}E${episode}`,
        streams: [],
      })
    }
    map.get(key).streams.push(s)
  }
  return [...map.values()].sort(
    (a, b) => a.season - b.season || a.episode - b.episode,
  )
}

function extractSeasonEpisode(text) {
  const t = String(text)
  let season = null
  let episode = null
  const fa = t.match(/فصل\s*(\d+)[\s\S]{0,40}?قسمت\s*(\d+)/i)
  if (fa) {
    season = Number(fa[1])
    episode = Number(fa[2])
  } else {
    const ep = t.match(/قسمت\s*(\d+)/i)
    if (ep) episode = Number(ep[1])
    const se = t.match(/فصل\s*(\d+)/i)
    if (se) season = Number(se[1])
  }
  const en = t.match(/S(\d+)E(\d+)/i)
  if (en) {
    season = Number(en[1])
    episode = Number(en[2])
  }
  return { season, episode }
}

function isContentUrl(abs, base) {
  try {
    const u = new URL(abs)
    const b = new URL(base)
    if (u.hostname.replace(/^www\./, '') !== b.hostname.replace(/^www\./, '')) {
      return false
    }
    // /2026/10/16/slug/
    if (/\/20\d{2}\/\d{1,2}\/\d{1,2}\/[\w%-]+/i.test(u.pathname)) return true
    return false
  } catch {
    return false
  }
}

function isPlayableUrl(abs) {
  try {
    const u = new URL(abs)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const s = abs.toLowerCase()
    if (/\.(mp4|mkv|m3u8)(\?|$)/i.test(s)) return true
    if (/cinamadownload\.top/i.test(u.hostname)) return true
    if (/\b(cdn|dl\d*)\b/i.test(u.hostname) && u.pathname.length > 6) return true
    return false
  } catch {
    return false
  }
}

function extractPoster(htmlSlice, base) {
  const src =
    match1(htmlSlice, /<img[^>]+src=["']([^"']+)["']/i) ||
    match1(htmlSlice, /data-src=["']([^"']+)["']/i)
  if (!src || /logo|icon|svg|avatar/i.test(src)) return undefined
  const abs = resolveUrl(base, src)
  if (abs && /\.(jpe?g|png|webp)(\?|$)/i.test(abs)) return abs
  return abs || undefined
}

function extractYear(text) {
  const m = String(text).match(/\b(19|20)\d{2}\b/)
  return m ? Number(m[0]) : null
}

function extractSize(text) {
  const m = String(text).match(/\b(\d+(?:\.\d+)?\s*(?:GB|MB|گیگ|مگ))\b/i)
  if (!m) return null
  return m[1].replace(/گیگ/i, 'GB').replace(/مگ/i, 'MB')
}

function cleanTitle(t) {
  return String(t)
    .replace(/دانلود\s*(فیلم|سریال|انیمه)?/gi, '')
    .replace(/بدون\s*سانسور.*$/gi, '')
    .replace(/با\s*زیرنویس.*$/gi, '')
    .replace(/–\s*سینماتیک.*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTags(s) {
  return String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtml(s) {
  return String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"')
}

function resolveUrl(base, href) {
  try {
    return new URL(href, base.endsWith('/') ? base : base + '/').toString()
  } catch {
    return null
  }
}

function pathFromUrl(abs, base) {
  try {
    const u = new URL(abs)
    const b = new URL(base)
    if (u.hostname.replace(/^www\./, '') !== b.hostname.replace(/^www\./, '')) {
      return null
    }
    return (u.pathname.replace(/^\/+/, '') + u.search).replace(/\/+$/, '')
  } catch {
    return null
  }
}

function match1(s, re) {
  const m = String(s).match(re)
  return m ? m[1] : null
}
