/**
 * Cinamatic (cinamatic.top) HTML parsers.
 * Paths: /YYYY/MM/DD/slug/ — WordPress date permalinks.
 * Listing pages mix a hero rail of popular series; we strip that and keep category body only.
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

/**
 * Drop shared homepage hero (برترین…) so category pages only yield that category.
 */
function categoryBody(html, forceType) {
  const markers =
    forceType === 'movie'
      ? ['دسته فیلم', 'دسته\s*فیلم', 'category/film', 'class="archive']
      : forceType === 'series'
        ? ['دسته سریال', 'دسته\s*سریال', 'دسته انیمه', 'دسته\s*انیمه', 'category/series', 'category/anime']
        : ['دسته فیلم', 'دسته سریال', 'دسته انیمه', 'class="archive']

  let start = -1
  for (const mk of markers) {
    const re = new RegExp(mk, 'i')
    const m = html.match(re)
    if (m && m.index != null && m.index > 0) {
      start = m.index
      break
    }
  }
  if (start > 200) return html.slice(start)
  // fallback: cut after first long hero block if present
  const hero = html.search(/برترین\s*(فیلم|سریال)/i)
  if (hero >= 0) {
    const afterHero = html.indexOf('ادامه و دانلود', hero)
    if (afterHero > hero) return html.slice(Math.max(0, afterHero - 500))
  }
  return html
}

export function parseListingHtml(html, baseUrl, forceType) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const body = categoryBody(String(html || ''), forceType)
  const results = []
  const seen = new Set()

  // Prefer explicit title links inside category cards: h2 > a or a around «ادامه و دانلود»
  const patterns = [
    /<h2[^>]*>\s*<a[^>]+href=["'](https?:\/\/[^"']+|\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>/gi,
    /<a[^>]+href=["'](https?:\/\/[^"']+|\/[^"']+)["'][^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>/gi,
    /<a[^>]+href=["'](https?:\/\/[^"']+|\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  ]

  for (const linkRe of patterns) {
    let m
    while ((m = linkRe.exec(body)) !== null) {
      const abs = resolveUrl(base, m[1])
      if (!abs || !isContentUrl(abs, base)) continue
      const pagePath = pathFromUrl(abs, base)
      if (!pagePath || seen.has(pagePath)) continue

      let title = cleanTitle(stripTags(m[2]))
      if (!title || title.length < 2) continue
      if (/^(ادامه|دانلود|مشاهده|تریلر|ورود|عضویت|برترین)/i.test(title)) continue

      const window = body.slice(Math.max(0, m.index - 400), m.index + 900)

      // Hero series bleed: «قسمت N از فصل» next to card → skip on movie catalog
      if (forceType === 'movie' && /قسمت\s*\d+\s*از\s*فصل|پایان\s*فصل/i.test(window)) {
        continue
      }
      // On series/anime catalog skip pure movie cards if strongly labeled فیلم only + runtime without قسمت
      if (
        forceType === 'series' &&
        /مدت\s*زمان\s*:/i.test(window) &&
        !/قسمت|فصل|سریال/i.test(window)
      ) {
        // still allow — category page should already be series
      }

      const poster = extractPoster(window, base)
      const year = extractYear(title) || extractYear(window)

      seen.add(pagePath)
      results.push({
        itemId: encodePageId(pagePath),
        title,
        year: year || undefined,
        type: forceType || inferType(window, title),
        poster: poster || undefined,
        pagePath,
      })
      if (results.length >= 36) break
    }
    if (results.length >= 12) break
  }

  return results
}

function inferType(window, title) {
  if (/قسمت\s*\d+|فصل\s*\d+|سریال|انیمه/i.test(window + ' ' + title)) return 'series'
  return 'movie'
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
    /فصل\s*\d+|قسمت\s*\d+|season|episode/i.test(html.slice(0, 30000))

  return {
    title: clean,
    year: year || undefined,
    type: isSeries ? 'series' : 'movie',
    poster: poster ? resolveUrl(base, poster) : undefined,
    description: description || undefined,
  }
}

/**
 * Collect playable links. For series, attach season/episode from section headers
 * like «فصل 1 - زیرنویس کیفیت 1080» then «قسمت 3».
 */
export function parseDetailStreams(html, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const out = []
  const seen = new Set()

  // Pre-scan section headers with positions for season/quality/audio context
  const sections = []
  const secRe =
    /فصل\s*(\d+)\s*[-–—]?\s*(دوبله\s*فارسی|زیرنویس)?[^<]{0,40}?کیفیت\s*(2160|1080|720|480)/gi
  let sm
  while ((sm = secRe.exec(html)) !== null) {
    sections.push({
      index: sm.index,
      season: Number(sm[1]),
      audio: /دوبله/i.test(sm[2] || '') ? 'dub' : /زیرنویس/i.test(sm[2] || '') ? 'sub' : null,
      quality: sm[3] ? `${sm[3]}p` : null,
    })
  }
  // Also: «فصل 1 - زیرنویس کیفیت 1080» without optional group
  const secRe2 =
    /فصل\s*(\d+)[^\n<]{0,80}?(دوبله|زیرنویس)?[^\n<]{0,40}?(2160|1080|720|480)/gi
  while ((sm = secRe2.exec(html)) !== null) {
    if (sections.some((s) => Math.abs(s.index - sm.index) < 20)) continue
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

    const local = html.slice(Math.max(0, am.index - 400), am.index + am[0].length + 80)
    const localText = stripTags(local) + ' ' + text
    const fromUrl = analyzeMediaUrl(abs)
    const sec = sectionAt(am.index)

    const quality =
      fromUrl.quality ||
      extractQuality(localText) ||
      extractQuality(text) ||
      sec?.quality ||
      null
    const size = extractSize(localText) || extractSize(text)
    let audio = fromUrl.audio || sec?.audio || null
    if (!audio) {
      if (/دوبله/i.test(localText)) audio = 'dub'
      else if (/زیرنویس/i.test(localText)) audio = 'sub'
    }
    const codec =
      fromUrl.codec ||
      (/x265|HEVC/i.test(localText) ? 'x265' : /x264/i.test(localText) ? 'x264' : null)

    let seasonEp = extractSeasonEpisode(abs, localText)
    if (!seasonEp.episode) {
      // «قسمت 3 678MB» as link text
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
