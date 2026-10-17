/**
 * DigiMovie HTML parsers — clean-room for digimoviez*.top WordPress theme.
 *
 * Paths observed:
 *   /movies/  /series/
 *   /category/انیمه/  /category/سریال-کره-ای/  /category/فیلم-هندی/
 *   movie detail: /slug-year/
 *   series detail: /serie/slug/
 */

const SECTION_ROOTS = new Set([
  'movies',
  'series',
  'serie',
  'category',
  'genre',
  'tag',
  'account',
  'dashboard',
  'login',
  'page',
  'wp-admin',
  'wp-content',
  'wp-json',
  'top-250',
  'search',
])

const NOISE_TITLES =
  /^(ورود|خروج|ثبت\s*نام|تماس|قوانین|DMCA|Home|خانه|جستجو|Search|Login|Logout)$/i

export function parseListingHtml(html, baseUrl, forceType) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const results = []
  const seen = new Set()

  // Prefer main content
  let scope = html
  const main =
    html.match(/<main[\s\S]*?<\/main>/i) ||
    html.match(/class="[^"]*(?:archive|content-area|site-main)[^"]*"[\s\S]{0,200000}/i)
  if (main) scope = main[0]

  // Cards / articles with detail links
  const linkRe =
    /<a[^>]+href=["'](https?:\/\/[^"']+|\/[^"']+)["'][^>]*(?:title=["']([^"']*)["'])?[^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = linkRe.exec(scope)) !== null) {
    const abs = resolveUrl(base, m[1])
    if (!abs || !sameHostFamily(abs, base)) continue
    const pagePath = pathFromUrl(abs)
    if (!pagePath || seen.has(pagePath) || isNoisePath(pagePath)) continue
    if (!isLikelyDetailPath(pagePath)) continue

    const title =
      cleanTitle(m[2] || '') ||
      cleanTitle(stripTags(m[3] || '')) ||
      cleanTitle(pagePath.split('/').pop().replace(/-/g, ' '))
    if (!title || title.length < 2 || isNoiseTitle(title)) continue

    // Poster near this link: look back ~800 chars for img
    const start = Math.max(0, m.index - 900)
    const slice = scope.slice(start, m.index + m[0].length + 200)
    let poster =
      match1(slice, /(?:data-src|src)=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/i) ||
      match1(slice, /background-image:\s*url\(([^)]+)\)/i)
    if (poster) {
      poster = poster.replace(/^['"]|['"]$/g, '').trim()
      poster = resolveUrl(base, poster) || poster
      if (/svg|icon|logo|sprite|avatar/i.test(poster)) poster = undefined
    }

    const type =
      forceType ||
      (/^serie\//i.test(pagePath) || /\/series\//i.test(pagePath) ? 'series' : 'movie')

    seen.add(pagePath)
    results.push({
      itemId: encodePageId(pagePath),
      title,
      year: extractYear(title) || extractYear(pagePath),
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
  const year = clean ? extractYear(clean) : extractYear(html.slice(0, 12000))
  const imdb = match1(html, /imdb\.com\/title\/(tt\d+)/i)
  let poster =
    match1(html, /property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
    match1(html, /"thumbnailUrl"\s*:\s*"(https?:[^"\\]+)"/i)
  if (poster) poster = resolveUrl(base, poster) || poster
  const ogUrl = match1(html, /property=["']og:url["'][^>]*content=["']([^"']+)["']/i) || ''
  const type =
    /\/serie\//i.test(ogUrl) || /TVSeries|series/i.test(html.slice(0, 8000))
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
  const out = []
  const seen = new Set()
  const aRe = /<a[^>]+href=["']([^"']+)["'][^>]*(?:>([\s\S]*?)<\/a>|(?:\s*\/>))/gi
  let am
  while ((am = aRe.exec(html)) !== null) {
    const href = decodeHtml(am[1])
    if (!isPlayableUrl(href)) continue
    if (seen.has(href)) continue
    seen.add(href)

    const start = Math.max(0, am.index - 450)
    const local = html.slice(start, am.index + am[0].length + 100)
    const localText = stripTags(local) + ' ' + href
    const info = analyze(href, localText)

    const se = href.match(/[Ss]0?(\d+)[Ee]0?(\d+)/)
    if (se) {
      info.season = Number(se[1])
      info.episode = Number(se[2])
    } else {
      const epFa = match1(localText, /قسمت\s*([\d\u06f0-\u06f9]+)/)
      if (epFa) info.episode = Number(toAsciiDigits(epFa))
      const snFa = match1(localText, /فصل\s*([\d\u06f0-\u06f9]+)/)
      if (snFa) info.season = Number(toAsciiDigits(snFa))
    }

    out.push({
      url: href,
      ...info,
      label: formatLabel(info),
      badge: qualityBadge(info.quality),
    })
  }

  const rank = (s) => {
    const q = parseInt(String(s.quality || '').replace(/\D/g, ''), 10) || 0
    return q + (s.hdr ? 40 : 0) + (s.audio === 'dub' ? 8 : 0)
  }
  out.sort((a, b) => rank(b) - rank(a))
  return out
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
    match1(t, /(?:DigiMovie|PSA|Pahe|PaHe|FLUX|YTS|RARBG)(?=\.|\s|$|\?)/i) || undefined
  return {
    quality: quality || undefined,
    size: size || undefined,
    audio,
    source,
    codec,
    hdr: Boolean(hdr),
    bit10: Boolean(bit10),
    encoder,
    providerName: 'DigiMovie',
    providerEmoji: '💎',
  }
}

function formatLabel(info) {
  const lines = []
  lines.push(`${info.providerEmoji || '💎'} منبع: ${info.providerName || 'DigiMovie'}`)
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
    if (/\.(mp4|mkv|m3u8)(\?|$)/i.test(s)) return true
    if (/\/dl\d?\/|cdn\d*\.|digi.*dl/i.test(s)) return true
    return false
  } catch {
    return false
  }
}

function isNoiseTitle(title) {
  const t = String(title || '').trim()
  if (!t || t.length <= 2) return true
  if (NOISE_TITLES.test(t)) return true
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
  // /serie alone is section-ish; /serie/slug is detail — handled in isLikelyDetailPath
  if (segs[0] === 'serie' && segs.length === 1) return true
  if (segs[0] === 'category') return true
  return false
}

function isLikelyDetailPath(pagePath) {
  const segs = String(pagePath).split('/').filter(Boolean)
  if (!segs.length) return false
  // /serie/slug
  if (segs[0] === 'serie' && segs.length >= 2 && segs[1] !== 'page') return true
  // /slug-2026 single segment movie
  if (segs.length === 1 && segs[0].length > 3 && !SECTION_ROOTS.has(segs[0].toLowerCase())) {
    return true
  }
  return false
}

function sameHostFamily(a, b) {
  try {
    const ha = new URL(a).hostname.replace(/^www\./i, '').toLowerCase()
    const hb = new URL(b).hostname.replace(/^www\./i, '').toLowerCase()
    if (ha === hb) return true
    // digimoviez53.top ↔ digimoviez.com family
    const digi = (h) => /digimoviez/i.test(h)
    if (digi(ha) && digi(hb)) return true
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

function pathFromUrl(abs) {
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
    .replace(/-\s*دیجی\s*موویز?.*$/gi, '')
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

function match1(s, re) {
  const m = String(s).match(re)
  return m ? m[1] : null
}
