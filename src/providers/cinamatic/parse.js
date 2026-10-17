/**
 * Cinamatic (cinamatic.top) HTML parsers.
 * Paths: /YYYY/MM/DD/slug/ — WordPress date permalinks.
 * Listing: strip shared hero, keep only the matching category body.
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

/**
 * @param {string} html
 * @param {'film'|'series'|'anime'|null} kind
 */
function categoryBody(html, kind) {
  const markers =
    kind === 'film'
      ? ['دسته فیلم', 'دسته\s*فیلم']
      : kind === 'anime'
        ? ['دسته انیمه', 'دسته\s*انیمه', 'دسته انیمه‌ها']
        : kind === 'series'
          ? ['دسته سریال', 'دسته\s*سریال']
          : ['دسته فیلم', 'دسته سریال', 'دسته انیمه', 'دسته انیمه‌ها']

  let start = -1
  for (const mk of markers) {
    const re = new RegExp(mk, 'i')
    const m = html.match(re)
    if (m && m.index != null && m.index > 50) {
      start = m.index
      break
    }
  }
  if (start > 50) return html.slice(start)

  // Drop shared «برترین» hero if present
  const hero = html.search(/برترین\s*(فیلم|سریال)/i)
  if (hero >= 0) {
    const after = html.search(/دسته\s*(فیلم|سریال|انیمه)/i)
    if (after > hero) return html.slice(after)
  }
  return html
}

/**
 * @param {string} html
 * @param {string} baseUrl
 * @param {'movie'|'series'|null} forceType
 * @param {'film'|'series'|'anime'|null} kind
 */
export function parseListingHtml(html, baseUrl, forceType, kind = null) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const body = categoryBody(String(html || ''), kind)
  const results = []
  const seen = new Set()

  // Prefer h2 title links (main archive cards)
  const patterns = [
    /<h2[^>]*>\s*<a[^>]+href=["'](https?:\/\/[^"']+|\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>/gi,
    /<a[^>]+href=["'](https?:\/\/[^"']+|\/[^"']+)["'][^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>/gi,
  ]

  for (const linkRe of patterns) {
    let m
    while ((m = linkRe.exec(body)) !== null) {
      pushCard(results, seen, base, m[1], m[2], body, m.index, forceType, kind)
    }
  }

  // Fallback: «ادامه و دانلود» near title links
  if (results.length < 4) {
    const aRe =
      /<a[^>]+href=["'](https?:\/\/[^"']+|\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    let m
    while ((m = aRe.exec(body)) !== null) {
      const text = stripTags(m[2] || '')
      if (!/ادامه|دانلود/i.test(text) && text.length < 8) continue
      // Prefer the nearest h2 title as name
      const window = body.slice(Math.max(0, m.index - 1200), m.index + 50)
      const title =
        match1(window, /<h2[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i) ||
        match1(window, /<h2[^>]*>([\s\S]*?)<\/h2>/i) ||
        text
      pushCard(results, seen, base, m[1], title, body, m.index, forceType, kind)
    }
  }

  return results
}

function pushCard(results, seen, base, href, rawTitle, body, index, forceType, kind) {
  const abs = resolveUrl(base, href)
  if (!abs || !isContentUrl(abs, base)) return
  const pagePath = pathFromUrl(abs, base)
  if (!pagePath || seen.has(pagePath)) return

  let title = cleanTitle(stripTags(rawTitle))
  if (!title || title.length < 2) return
  if (/^(ادامه|دانلود|مشاهده|تریلر|ورود|عضویت|برترین)/i.test(title)) return

  const window = body.slice(Math.max(0, index - 400), index + 1000)

  // Film catalog: drop series-looking hero bleed
  if ((forceType === 'movie' || kind === 'film') && /قسمت\s*\d+\s*از\s*فصل|پایان\s*فصل/i.test(window)) {
    return
  }

  const poster = extractPoster(window, base)
  const year = extractYear(title) || extractYear(window)
  const type =
    forceType ||
    (kind === 'film' ? 'movie' : kind === 'series' || kind === 'anime' ? 'series' : inferType(window, title))

  seen.add(pagePath)
  results.push({
    itemId: encodePageId(pagePath),
    title,
    year: year || undefined,
    type,
    poster: poster || undefined,
    pagePath,
  })
}

function inferType(window, title) {
  if (/قسمت\s*\d+|فصل\s*\d+|سریال|انیمه/i.test(window + ' ' + title)) return 'series'
  return 'movie'
}

export function parseSearchHtml(html, baseUrl) {
  return parseListingHtmlKeepAll(html, baseUrl)
}

function parseListingHtmlKeepAll(html, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const results = []
  const seen = new Set()
  const linkRe =
    /<h2[^>]*>\s*<a[^>]+href=["'](https?:\/\/[^"']+|\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>/gi
  let m
  while ((m = linkRe.exec(html)) !== null) {
    pushCard(results, seen, base, m[1], m[2], html, m.index, null, null)
  }
  if (results.length < 4) {
    const aRe =
      /<a[^>]+href=["'](https?:\/\/[^"']+|\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    while ((m = aRe.exec(html)) !== null) {
      const title = cleanTitle(stripTags(m[2]))
      if (!title || title.length < 3) continue
      if (/^(ادامه|دانلود|مشاهده|تریلر)/i.test(title)) continue
      pushCard(results, seen, base, m[1], title, html, m.index, null, null)
    }
  }
  return results
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
    /فصل\s*\d+|قسمت\s*\d+|season|episode/i.test(html.slice(0, 30000))

  return {
    title: clean,
    year: year || undefined,
    type: isSeries ? 'series' : 'movie',
    poster: poster ? resolveUrl(base, poster) : undefined,
    description: description || undefined,
  }
}

export function parseDetailStreams(html, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const out = []
  const seen = new Set()

  const sections = []
  const secRe2 =
    /فصل\s*(\d+)[^\n<]{0,80}?(دوبله|زیرنویس)?[^\n<]{0,40}?(2160|1080|720|480)/gi
  let sm
  while ((sm = secRe2.exec(html)) !== null) {
    sections.push({
      index: sm.index,
      season: Number(sm[1]),
      audio: /دوبله/i.test(sm[0]) ? 'dub' : /زیرنویس/i.test(sm[0]) ? 'sub' : null,
      quality: sm[3] ? `${sm[3]}p` : null,
    })
  }
  sections.sort((a, b) => a.index - b.index)

  function sectionAt(pos) {
    let best = null
    for (const s of sections) {
      if (s.index <= pos) best = s
      else break
    }
    return best
  }

  const aRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let am
  while ((am = aRe.exec(html)) !== null) {
    const href = decodeHtml(am[1])
    const abs = resolveUrl(base, href)
    if (!abs || !isPlayableUrl(abs)) continue
    if (seen.has(abs)) continue
    const text = stripTags(am[2] || '')
    if (/تریلر|trailer/i.test(text) && /trailers\//i.test(abs)) continue
    seen.add(abs)

    const local = html.slice(Math.max(0, am.index - 500), am.index + am[0].length + 100)
    const localText = stripTags(local) + ' ' + text
    const fromUrl = analyzeMediaUrl(abs)
    const sec = sectionAt(am.index)

    const quality =
      fromUrl.quality ||
      extractQuality(text) ||
      extractQuality(localText) ||
      sec?.quality ||
      null
    const size =
      extractSizeFromText(text) ||
      extractSizeFromText(localText) ||
      fromUrl.size ||
      null
    let audio = fromUrl.audio || sec?.audio || null
    if (!audio) {
      if (/دوبله/i.test(localText)) audio = 'dub'
      else if (/زیرنویس/i.test(localText)) audio = 'sub'
    }
    const codec =
      fromUrl.codec ||
      (/x265|HEVC/i.test(text + localText) ? 'x265' : /x264/i.test(text + localText) ? 'x264' : null)
    const encoder =
      fromUrl.encoder ||
      extractEncoderFromText(abs) ||
      extractEncoderFromText(text) ||
      extractEncoderFromText(localText) ||
      null
    const source =
      fromUrl.source ||
      (/BluRay|BDRip/i.test(localText) ? 'BluRay' : /WEB-?DL/i.test(localText) ? 'WEB-DL' : null)

    let seasonEp = extractSeasonEpisode(abs, localText)
    if (!seasonEp.episode) {
      const epOnly = text.match(/قسمت\s*(\d+)/i) || localText.match(/قسمت\s*(\d+)/i)
      if (epOnly) {
        seasonEp = {
          season: seasonEp.season || sec?.season || 1,
          episode: Number(epOnly[1]),
        }
      }
    }
    if (seasonEp.season == null && sec?.season) seasonEp.season = sec.season

    const info = {
      quality,
      size,
      audio,
      source,
      codec,
      encoder,
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
  let season = null
  let episode = null
  const u = String(url || '')
  let m = u.match(/[Ss](\d+)[Ee](\d+)/)
  if (m) return { season: Number(m[1]), episode: Number(m[2]) }
  m = u.match(/[\/_-](\d{1,2})x(\d{1,3})[\/_\-.]/i)
  if (m) return { season: Number(m[1]), episode: Number(m[2]) }

  const t = String(text || '')
  const fa = t.match(/فصل\s*(\d+)[\s\S]{0,50}?قسمت\s*(\d+)/i)
  if (fa) {
    season = Number(fa[1])
    episode = Number(fa[2])
  } else {
    const ep = t.match(/قسمت\s*(\d+)/i)
    if (ep) episode = Number(ep[1])
    const se = t.match(/فصل\s*(\d+)/i)
    if (se) season = Number(se[1])
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
  return resolveUrl(base, src) || undefined
}

function extractYear(text) {
  const m = String(text).match(/\b(19|20)\d{2}\b/)
  return m ? Number(m[0]) : null
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
