/**
 * AvaMovie HTML parsers — item-movie cards, downloadbox / dl-item streams.
 */

import { extractPosterFromCardHtml, normalizeAvaPosterUrl } from './poster.js'

const AVA_HOSTS = new Set(['avadel.top', 'avamovie.shop', 'www.avamovie.shop'])

/** Pure section roots (not detail pages). */
const SECTION_ROOTS = new Set([
  'movies',
  'series',
  'genre',
  'category',
  'tag',
  'person',
  'peoples',
  'account',
  'login',
  'logout',
  'buy-subscription',
  'streams',
  'anime',
  'animation',
  'doc',
  'oscar',
  'boxoffice',
  'collections',
  'list',
  'country',
  'movie-dub',
  'series-dub',
  '250movie',
  '250series',
  'east-asian-series',
  'series-status',
  'wp-admin',
  'wp-content',
  'page',
  'contact',
  'dmca',
  'rules',
  'application',
  'app',
  'terms',
  'privacy',
  'register',
  'cart',
  'checkout',
])

const NOISE_TITLES =
  /^(خروج|تماس\s*با\s*ما|قوانین|اپلیکیشن|ورود|ثبت\s*نام|خرید\s*اشتراک|حساب\s*کاربری|DMCA|Contact|Login|Logout|Home|خانه|جستجو|Search)$/i

export function parseListingHtml(html, baseUrl, forceType) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const results = []
  const seen = new Set()

  let scope = html
  const arch = html.match(
    /class="[^"]*archive-posts[^"]*"[\s\S]*?(?=<footer|class="[^"]*site-pagination|id="footer|$)/i,
  )
  if (arch) scope = arch[0]

  const cardRe =
    /class="[^"]*item-movie[^"]*"[\s\S]*?(?=class="[^"]*item-movie|site-pagination|<\/main>|<footer|$)/gi
  let m
  while ((m = cardRe.exec(scope)) !== null) {
    const block = m[0]
    const href =
      match1(block, /<a[^>]+href=["'](https?:\/\/[^"']+|\/[^"']+)["']/i) ||
      match1(block, /href=["'](\/[^"']+)["']/i)
    if (!href) continue
    const abs = resolveUrl(base, href)
    if (!abs || !sameSite(abs, base)) continue
    const pagePath = pathFromUrl(abs, base)
    if (!pagePath || seen.has(pagePath) || isNoisePath(pagePath)) continue

    const titleAttr = match1(block, /title=["']([^"']+)["']/i)
    const titleEn = match1(block, /class=["']title_en["'][^>]*>([\s\S]*?)<\/div>/i)
    const title =
      cleanTitle(titleEn || '') ||
      cleanTitle(titleAttr || '') ||
      cleanTitle(match1(block, /class=["']title["'][^>]*>([\s\S]*?)<\/div>/i) || '')
    if (!title || title.length < 2 || isNoiseTitle(title)) continue

    const yearRaw = match1(block, /class=["']year["'][^>]*>([\s\S]*?)<\/div>/i) || ''
    const year =
      extractYear(yearRaw) || extractYear(titleAttr || '') || extractYear(title)

    // Public CDN rewrite (Amazon) — same role as F2Media intocdn posters
    const poster = extractPosterFromCardHtml(block, base)

    const type =
      forceType ||
      (/^series\//i.test(pagePath) || /\banime\b/i.test(pagePath) ? 'series' : 'movie')

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

  if (results.length < 4 && arch) {
    const linkRe =
      /<a[^>]+href=["'](https?:\/\/[^"']+|\/[^"']+)["'][^>]*title=["']([^"']+)["']/gi
    let lm
    while ((lm = linkRe.exec(scope)) !== null) {
      const abs = resolveUrl(base, lm[1])
      if (!abs || !sameSite(abs, base)) continue
      const pagePath = pathFromUrl(abs, base)
      if (!pagePath || seen.has(pagePath) || isNoisePath(pagePath)) continue
      if (!isLikelyDetailPath(pagePath)) continue
      const title = cleanTitle(lm[2])
      if (!title || title.length < 2 || isNoiseTitle(title)) continue
      if (!/[a-z0-9\-]{4,}/i.test(pagePath.split('/').pop() || '')) continue
      seen.add(pagePath)
      results.push({
        itemId: encodePageId(pagePath),
        title,
        year: extractYear(title) || undefined,
        type: forceType || (/^series\//i.test(pagePath) ? 'series' : 'movie'),
        pagePath,
      })
      if (results.length >= 40) break
    }
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
  const imdb = match1(html, /imdb\.com\/title\/(tt\d+)/i)
  let poster =
    match1(html, /property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
    match1(html, /"thumbnailUrl"\s*:\s*"(https?:[^"\\]+)"/i)
  if (poster) {
    poster = normalizeAvaPosterUrl(poster, base) || normalizeAvaPosterUrl(resolveUrl(base, poster), base)
  }
  const type = /\/series\//i.test(
    match1(html, /property=["']og:url["'][^>]*content=["']([^"']+)["']/i) || '',
  )
    ? 'series'
    : /TVSeries|series/i.test(html.slice(0, 8000))
      ? 'series'
      : 'movie'
  return {
    title: clean,
    year: year || undefined,
    imdb: imdb || undefined,
    type,
    poster: poster || undefined,
  }
}

export function parseDetailStreams(html, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const out = []
  const seen = new Set()

  const boxes = []
  const boxRe =
    /class="[^"]*downloadbox[^"]*"[\s\S]*?(?=class="[^"]*single-related|class="[^"]*downloadbox|<footer|$)/gi
  let bm
  while ((bm = boxRe.exec(html)) !== null) boxes.push(bm[0])
  if (!boxes.length) boxes.push(html)

  for (const box of boxes) {
    const itemRe =
      /class="[^"]*dl-item[^"]*"[\s\S]*?(?=class="[^"]*dl-item|class="[^"]*single-related|$)/gi
    let im
    let foundSeason = false
    while ((im = itemRe.exec(box)) !== null) {
      foundSeason = true
      const block = im[0]
      const seasonFa = match1(block, /class="season"[^>]*>([\s\S]*?)<\/span>/i)
      const season = persianSeason(seasonFa) || 1
      collectEpisodeLinks(block, base, out, seen, season)
      const cardSize = match1(
        block,
        /class="size"[^>]*>[\s\S]*?<span class="label">[\s\S]*?<\/span>\s*([^<]+)/i,
      )
      if (cardSize) {
        for (const s of out.slice(-12)) {
          if (!s.size) s.size = normalizeSize(cardSize)
        }
      }
    }
    if (!foundSeason) {
      collectMovieLinks(box, base, out, seen)
    }
  }

  collectMovieLinks(html, base, out, seen)

  const rank = (s) => {
    const q = parseInt(String(s.quality || '').replace(/\D/g, ''), 10) || 0
    return q + (s.hdr ? 40 : 0) + (s.audio === 'dub' ? 8 : 0) + (s.codec === 'x265' ? 3 : 0)
  }
  out.sort((a, b) => rank(b) - rank(a))
  return out.filter((s) => !s.isAudioOnly)
}

export function buildSeriesVideos(streams) {
  const map = new Map()
  for (const s of streams || []) {
    if (s.episode == null) continue
    const season = Number(s.season || 1)
    const episode = Number(s.episode)
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
  return [...map.values()].sort((a, b) => a.season - b.season || a.episode - b.episode)
}

export function encodePageId(pagePath) {
  return Buffer.from(String(pagePath), 'utf8').toString('base64url')
}

export function decodePageId(itemId) {
  try {
    const raw = String(itemId || '')
    if (!/^[A-Za-z0-9_-]+$/.test(raw)) return null
    const p = Buffer.from(raw, 'base64url').toString('utf8')
    if (!p || p.includes('..') || p.includes('://')) return null
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(p)) return null
    return p.replace(/^\/+/, '')
  } catch {
    return null
  }
}

function collectMovieLinks(html, base, out, seen) {
  const aRe = /<a[^>]+href=["']([^"']+)["'][^>]*(?:>([\s\S]*?)<\/a>|(?:\s*\/>))/gi
  let am
  while ((am = aRe.exec(html)) !== null) {
    const href = decodeHtml(am[1])
    if (!isPlayableUrl(href)) continue
    if (seen.has(href)) continue
    const isAudioOnly = /\.(mka|aac|mp3)(\?|$)/i.test(href)
    seen.add(href)

    const start = Math.max(0, am.index - 500)
    const local = html.slice(start, am.index + (am[0]?.length || 0) + 120)
    const localText = stripTags(local) + ' ' + href
    const info = analyze(href, localText)
    info.isAudioOnly = isAudioOnly
    out.push({
      url: href,
      ...info,
      label: formatLabel(info),
      badge: qualityBadge(info.quality),
    })
  }
}

function collectEpisodeLinks(block, base, out, seen, season) {
  const aRe =
    /<a[^>]+href=["']([^"']+)["'][^>]*(?:title=["']([^"']*)["'])?[^>]*(?:>([\s\S]*?)<\/a>|(?:\s*\/>))/gi
  let am
  while ((am = aRe.exec(block)) !== null) {
    const href = decodeHtml(am[1])
    if (!isPlayableUrl(href)) continue
    if (seen.has(href)) continue
    const isAudioOnly = /\.(mka|aac|mp3)(\?|$)/i.test(href)
    seen.add(href)

    const full = href.match(/[Ss]0?(\d+)[Ee]0?(\d+)/)
    let episode = null
    let seasonNum = season
    if (full) {
      seasonNum = Number(full[1]) || season
      episode = Number(full[2])
    } else {
      const epFromTitle =
        match1(am[2] || '', /(\d+)/) || match1(am[3] || '', /قسمت\s*([\d\u06f0-\u06f9]+)/)
      if (epFromTitle) episode = Number(toAsciiDigits(epFromTitle))
    }

    const start = Math.max(0, am.index - 400)
    const local = block.slice(start, am.index + (am[0]?.length || 0) + 80)
    const info = analyze(href, stripTags(local) + ' ' + href)
    info.season = seasonNum
    info.episode = episode
    info.isAudioOnly = isAudioOnly
    out.push({
      url: href,
      ...info,
      label: formatLabel(info),
      badge: qualityBadge(info.quality),
    })
  }
}

function analyze(url, ctx) {
  const t = String(ctx || '') + ' ' + String(url || '')
  const quality =
    match1(t, /\b(2160p|1080p|720p|480p|360p)\b/i) ||
    match1(url, /\b(2160p|1080p|720p|480p)\b/i)
  const size = normalizeSize(match1(t, /\b(\d+(?:\.\d+)?\s*(?:GB|MB|گیگ|مگ))\b/i))
  const audio =
    /دوبله|Farsi\.Dubbed|Dubbed/i.test(t)
      ? 'dub'
      : /SoftSub|HardSub|زیرنویس/i.test(t)
        ? 'sub'
        : null
  const source =
    /BluRay/i.test(t)
      ? 'BluRay'
      : /WEB-?DL/i.test(t)
        ? 'WEB-DL'
        : /WEBRip/i.test(t)
          ? 'WEBRip'
          : null
  const codec = /x265|HEVC/i.test(t) ? 'x265' : /x264|h\.?264/i.test(t) ? 'x264' : null
  const hdr = /\bHDR\b/i.test(t)
  const bit10 = /10\s*bit|10bit/i.test(t)
  const encoder =
    match1(t, /(?:AvaMovie|PSA|Pahe|PaHe|FLUX|GRACE|RARBG)(?=\.|\s|$|\?)/i) || undefined
  return {
    quality: quality || undefined,
    size: size || undefined,
    audio,
    source,
    codec,
    hdr: Boolean(hdr),
    bit10: Boolean(bit10),
    encoder,
    providerName: 'AvaMovie',
    providerEmoji: '🎬',
  }
}

function formatLabel(info) {
  const lines = []
  lines.push(`${info.providerEmoji || '🎬'} منبع: ${info.providerName || 'AvaMovie'}`)
  const qParts = []
  if (info.quality) qParts.push(info.quality)
  if (info.source) qParts.push(info.source)
  if (info.codec) qParts.push(info.codec)
  if (info.bit10) qParts.push('10bit')
  if (info.hdr) qParts.push('HDR')
  if (qParts.length) lines.push(`📺 کیفیت: ${qParts.join(' ')}`)
  if (info.audio === 'sub') lines.push('📝 زیرنویس: زیرنویس چسبیده فارسی')
  if (info.audio === 'dub') lines.push('🎤 دوبله: دوبله فارسی')
  if (info.size) lines.push(`📦 حجم: ${info.size}`)
  if (info.encoder) lines.push(`⚙️ انکدر: ${info.encoder}`)
  if (info.season != null && info.episode != null) {
    lines.push(`S${info.season}E${info.episode}`)
  }
  return lines.join('\n')
}

function qualityBadge(q) {
  if (!q) return 'HD'
  const n = parseInt(String(q).replace(/\D/g, ''), 10)
  if (n >= 2160) return '4K'
  if (n >= 1080) return '1080p'
  if (n >= 720) return '720p'
  if (n >= 480) return '480p'
  return String(q)
}

function isPlayableUrl(href) {
  try {
    const u = new URL(href)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const s = href.toLowerCase()
    if (/\.(mp4|mkv|m3u8|mka)(\?|$)/i.test(s)) return true
    if (/yserver|\/dl\d?\//i.test(s)) return true
    return false
  } catch {
    return false
  }
}

function isNoiseTitle(title) {
  const t = String(title || '').trim()
  if (!t) return true
  if (NOISE_TITLES.test(t)) return true
  if (t.length <= 2) return true
  if (/^(contact|dmca|rules|app|application|about|faq)$/i.test(t)) return true
  return false
}

function isNoisePath(pagePath) {
  const segs = String(pagePath)
    .replace(/\/+$/, '')
    .toLowerCase()
    .split('/')
    .filter(Boolean)
  if (!segs.length) return true
  if (segs.length === 1 && SECTION_ROOTS.has(segs[0])) return true
  if (segs.length >= 2 && SECTION_ROOTS.has(segs[0]) && segs[1] === 'page') return true
  if (segs[0] === 'series' && segs.length >= 2 && segs[1] !== 'page') return false
  const joined = safeDecode(segs.join('/'))
  if (/خروج|تماس|قوانین|اپلیکیشن|ورود|اشتراک/.test(joined)) return true
  return false
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

function isLikelyDetailPath(pagePath) {
  const segs = String(pagePath).split('/').filter(Boolean)
  if (segs.length === 1 && segs[0].length > 3 && !SECTION_ROOTS.has(segs[0].toLowerCase())) {
    return true
  }
  if (segs[0] === 'series' && segs.length >= 2 && segs[1] !== 'page') return true
  return false
}

function persianSeason(text) {
  if (!text) return null
  const d = toAsciiDigits(stripTags(text))
  const m = d.match(/(\d{1,2})/)
  return m ? Number(m[1]) : null
}

function toAsciiDigits(s) {
  return String(s || '').replace(/[\u06f0-\u06f9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
}

function normalizeSize(s) {
  if (!s) return null
  return String(s)
    .replace(/گیگابایت/i, 'GB')
    .replace(/مگابایت/i, 'MB')
    .replace(/گیگ/i, 'GB')
    .replace(/مگ/i, 'MB')
    .trim()
}

function sameSite(a, b) {
  try {
    const ha = new URL(a).hostname.replace(/^www\./i, '').toLowerCase()
    const hb = new URL(b).hostname.replace(/^www\./i, '').toLowerCase()
    if (ha === hb) return true
    if (AVA_HOSTS.has(ha) && AVA_HOSTS.has(hb)) return true
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

function pathFromUrl(abs, base) {
  try {
    const u = new URL(abs)
    return (u.pathname.replace(/^\/+/, '') + u.search).replace(/\/+$/, '')
  } catch {
    return null
  }
}

function extractYear(text) {
  const m = String(text).match(/\b(19|20)\d{2}\b/)
  return m ? Number(m[0]) : null
}

function cleanTitle(t) {
  return stripTags(t)
    .replace(/دانلود\s*(فیلم|سریال|انیمیشن|انیمه)?/gi, '')
    .replace(/بدون\s*سانسور.*$/gi, '')
    .replace(/با\s*زیرنویس.*$/gi, '')
    .replace(/-\s*آوا\s*مووی.*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTags(s) {
  return String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&/g, '&')
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtml(s) {
  return String(s)
    .replace(/&/g, '&')
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
}

function match1(s, re) {
  const m = String(s).match(re)
  return m ? m[1] : null
}
