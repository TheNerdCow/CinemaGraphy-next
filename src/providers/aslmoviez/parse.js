/**
 * AslMoviez (aslmoviez.com) HTML parsers — clean-room.
 * Detail paths: /tt1234567 or /tt1234567-slug
 * Downloads: *aslddl*.sbs / *.mkv
 */

import {
  qualityBadge,
  formatStreamLabel,
  analyzeMediaUrl,
  extractQuality,
  extractSizeFromText,
  extractEncoderFromText,
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

export function imdbFromPath(pagePath) {
  const m = String(pagePath || '').match(/^(tt\d{5,})/i)
  return m ? m[1].toLowerCase() : null
}

/**
 * Listing cards: prefer anchors to /tt… pages.
 * @param {'movie'|'series'|null} forceType
 */
export function parseListingHtml(html, baseUrl, forceType = null) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const results = []
  const seen = new Set()

  // href="https://aslmoviez.com/tt123-slug" or /tt123
  const linkRe =
    /<a[^>]+href=["']((?:https?:\/\/[^"']+)?\/tt\d{5,}[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = linkRe.exec(html)) !== null) {
    const abs = resolveUrl(base, m[1])
    if (!abs || !isContentUrl(abs, base)) continue
    const pagePath = pathFromUrl(abs, base)
    if (!pagePath || seen.has(pagePath)) continue

    const chunk = stripTags(m[2] || '')
    let title =
      cleanTitle(chunk) ||
      cleanTitle(
        match1(m[0], /title=["']([^"']+)["']/i) ||
          match1(
            html.slice(Math.max(0, m.index - 50), m.index + 800),
            /(?:دانلود\s+(?:فیلم|سریال|انیمه)\s+)([^<\n]{2,80})/i,
          ) ||
          '',
      )
    if (!title || title.length < 2) continue
    if (/^(تماشا|دانلود|بعدی|قبلی|صفحه)$/i.test(title)) continue

    const window = html.slice(Math.max(0, m.index - 200), m.index + 1200)
    const year = extractYear(title) || extractYear(window)
    const poster = extractPoster(window, base)
    const type =
      forceType ||
      (/دانلود\s*سریال|دانلود\s*انیمه|series/i.test(window + ' ' + title)
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
      imdb: imdbFromPath(pagePath),
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
  const h1 =
    match1(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
    match1(html, /property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
  const title = h1 ? cleanTitle(stripTags(h1)) : undefined
  const year = title ? extractYear(title) : extractYear(html.slice(0, 12000))
  const poster =
    match1(html, /property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
    match1(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
  let description =
    match1(html, /property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
    match1(html, /<p[^>]*class=["'][^"']*desc[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)
  if (description) description = stripTags(description).slice(0, 1200)

  const imdbHref = match1(html, /href=["'](https?:\/\/(?:www\.)?imdb\.com\/title\/tt\d+)/i)
  const imdb =
    (imdbHref && imdbHref.match(/tt\d+/i)?.[0]?.toLowerCase()) || null

  const isSeries =
    /دانلود\s*سریال|فصل\s*[:\d]|season-item|episodes-grid/i.test(html.slice(0, 40000))

  return {
    title,
    year: year || undefined,
    type: isSeries ? 'series' : 'movie',
    poster: poster ? resolveUrl(base, poster) : undefined,
    description: description || undefined,
    imdb,
  }
}

/** Movie + series stream links. */
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
    const text = stripTags(am[2] || '')
    if (/تریلر|trailer/i.test(text) && /trailer/i.test(abs)) continue
    seen.add(abs)

    const local = html.slice(Math.max(0, am.index - 600), am.index + am[0].length + 120)
    const localText = stripTags(local) + ' ' + text
    const fromUrl = analyzeMediaUrl(abs)

    const quality =
      fromUrl.quality ||
      extractQuality(localText) ||
      extractQuality(text) ||
      extractQuality(abs)
    const size =
      extractSizeFromText(localText) ||
      extractSizeFromText(text) ||
      fromUrl.size ||
      null
    let audio = fromUrl.audio
    if (!audio) {
      if (/دوبله|Dubbed|\/Dub\//i.test(localText + abs)) audio = 'dub'
      else if (/زیرنویس|SoftSub|HardSub|\/SoftSub\//i.test(localText + abs)) audio = 'sub'
    }
    const codec =
      fromUrl.codec ||
      (/x265|HEVC|10Bit|10bit/i.test(localText + abs)
        ? /x265|HEVC/i.test(localText + abs)
          ? 'x265'
          : fromUrl.codec
        : /x264/i.test(localText + abs)
          ? 'x264'
          : null)
    const encoder =
      fromUrl.encoder ||
      extractEncoderFromText(abs) ||
      extractEncoderFromText(localText) ||
      match1(localText, /Encoder:\s*([A-Za-z0-9._-]+)/i)
    const source =
      fromUrl.source ||
      (/BluRay|BDRip/i.test(localText + abs)
        ? 'BluRay'
        : /WEB-?DL/i.test(localText + abs)
          ? 'WEB-DL'
          : /WEBRip/i.test(localText + abs)
            ? 'WEBRip'
            : null)

    const se = extractSeasonEpisode(abs, localText)

    const info = {
      quality,
      size,
      audio,
      source,
      codec,
      encoder,
      hdr: fromUrl.hdr,
      bit10: fromUrl.bit10 || /10Bit|10bit|10-bit/i.test(abs + localText),
      providerName: 'AslMoviez',
      providerEmoji: '🎬',
      season: se.season,
      episode: se.episode,
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

export function buildSeriesVideos(streams) {
  const map = new Map()
  for (const s of streams) {
    const episode = Number(s.episode)
    if (!episode) continue
    const season = Number(s.season) || 1
    const key = `${season}:${episode}`
    if (!map.has(key)) {
      map.set(key, {
        season,
        episode,
        title: `فصل ${season} - قسمت ${episode}`,
        streams: [],
      })
    }
    map.get(key).streams.push(s)
  }
  for (const ep of map.values()) {
    ep.streams.sort((a, b) => {
      const qa = parseInt(String(a.quality || '').replace(/\D/g, ''), 10) || 0
      const qb = parseInt(String(b.quality || '').replace(/\D/g, ''), 10) || 0
      return qb - qa
    })
  }
  return [...map.values()].sort((a, b) => a.season - b.season || a.episode - b.episode)
}

function extractSeasonEpisode(url, text) {
  const u = String(url || '')
  let m = u.match(/[Ss](\d+)[Ee](\d+)/)
  if (m) return { season: Number(m[1]), episode: Number(m[2]) }
  m = u.match(/[\/_-](\d{1,2})x(\d{1,3})[\/_\-.]/i)
  if (m) return { season: Number(m[1]), episode: Number(m[2]) }

  const t = String(text || '')
  const fa = t.match(/فصل\s*(\d+)[\s\S]{0,40}?قسمت\s*(\d+)/i)
  if (fa) return { season: Number(fa[1]), episode: Number(fa[2]) }
  const ep = t.match(/قسمت\s*(\d+)/i)
  const se = t.match(/فصل\s*(\d+)/i)
  return {
    season: se ? Number(se[1]) : null,
    episode: ep ? Number(ep[1]) : null,
  }
}

function isContentUrl(abs, base) {
  try {
    const u = new URL(abs)
    const b = new URL(base)
    if (u.hostname.replace(/^www\./, '') !== b.hostname.replace(/^www\./, '')) {
      return false
    }
    return /\/tt\d{5,}/i.test(u.pathname)
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
    if (/aslddl|\.sbs\//i.test(u.hostname + u.pathname)) return true
    if (/\b(cdn|dl\d*)\b/i.test(u.hostname) && u.pathname.length > 8) return true
    return false
  } catch {
    return false
  }
}

function extractPoster(htmlSlice, base) {
  const src =
    match1(htmlSlice, /<img[^>]+src=["']([^"']+)["']/i) ||
    match1(htmlSlice, /data-src=["']([^"']+)["']/i)
  if (!src || /logo|icon|svg|avatar|placeholder/i.test(src)) return undefined
  return resolveUrl(base, src) || undefined
}

function extractYear(text) {
  const m = String(text).match(/\b(19|20)\d{2}\b/)
  return m ? Number(m[0]) : null
}

function cleanTitle(t) {
  return String(t)
    .replace(/دانلود\s*(فیلم|سریال|انیمه|انیمیشن)?/gi, '')
    .replace(/با\s*زیرنویس.*$/gi, '')
    .replace(/بدون\s*سانسور.*$/gi, '')
    .replace(/اصل\s*موویز.*$/gi, '')
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
    return u.pathname.replace(/^\/+/, '').replace(/\/+$/, '')
  } catch {
    return null
  }
}

function match1(s, re) {
  const m = String(s).match(re)
  return m ? m[1] : null
}
