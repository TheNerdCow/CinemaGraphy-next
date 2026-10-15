/**
 * F2Media parsers — real page structure (download-list).
 */

export function parseSearchHtml(html, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const results = []
  const seen = new Set()

  const linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi
  const anchors = []
  let m
  while ((m = linkRe.exec(html)) !== null) {
    anchors.push({ href: m[1], inner: m[0] })
  }

  for (const a of anchors) {
    const abs = resolveUrl(base, a.href)
    if (!abs) continue
    if (!isLikelyDetailUrl(abs, base)) continue

    const title = extractTitle(a.inner) || extractTitleNearHref(html, a.href)
    if (!title || title.length < 2) continue
    if (isNoiseTitle(title)) continue

    const year = extractYear(a.inner) || extractYear(title)
    const type = inferType(a.inner + ' ' + title + ' ' + abs)
    let poster = extractImg(a.inner)
    if (poster) poster = resolveUrl(base, poster) || poster
    const pagePath = pathFromUrl(abs, base)
    if (!pagePath || seen.has(pagePath)) continue
    if (isNoisePath(pagePath)) continue
    seen.add(pagePath)

    results.push({
      itemId: encodePageId(pagePath),
      title: cleanTitle(title),
      year: year || undefined,
      type,
      poster: poster || undefined,
      pagePath,
    })
    if (results.length >= 40) break
  }
  return results
}

export function parseDetailStreams(html, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const out = []
  const seen = new Set()

  const parts = html.split(/class=["'][^"']*download-list/i)
  const blocks = []
  for (let i = 1; i < parts.length; i++) {
    blocks.push('class="download-list' + parts[i].slice(0, 4000))
  }

  for (const block of blocks) {
    const sectionAudio = /download-list\s+dubbled|دوبله/i.test(block)
      ? 'dub'
      : /download-list\s+hardsub|زیرنویس/i.test(block)
        ? 'sub'
        : null

    const aRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    let am
    while ((am = aRe.exec(block)) !== null) {
      const href = decodeHtml(am[1])
      const abs = resolveUrl(base, href)
      if (!abs || !isPlayableOrDownloadUrl(abs)) continue
      if (seen.has(abs)) continue
      const isAudioOnly = /\.(mka|aac|mp3)(\?|$)/i.test(abs)
      seen.add(abs)

      const fromUrl = analyzeMediaUrl(abs)
      const fromBlock = analyzeBlockText(block)
      const quality = fromUrl.quality || fromBlock.quality
      const size = fromBlock.size || fromUrl.size
      const audio = fromUrl.audio || sectionAudio || fromBlock.audio || null
      const source = fromUrl.source || fromBlock.source
      const codec = fromUrl.codec || fromBlock.codec
      const hdr = fromUrl.hdr || fromBlock.hdr
      const bit10 = fromUrl.bit10 || fromBlock.bit10
      const encoder = fromBlock.encoder

      const info = {
        quality,
        size,
        audio,
        source,
        codec,
        hdr: Boolean(hdr),
        bit10: Boolean(bit10),
        encoder,
        isAudioOnly,
        providerName: 'F2Media',
        providerEmoji: '🎬',
      }

      out.push({
        url: abs,
        ...info,
        label: formatStreamLabel(info),
        badge: qualityBadge(quality),
      })
    }
  }

  if (out.length === 0) {
    const aRe = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
    let am
    while ((am = aRe.exec(html)) !== null) {
      const abs = resolveUrl(base, decodeHtml(am[1]))
      if (!abs || !isPlayableOrDownloadUrl(abs) || seen.has(abs)) continue
      seen.add(abs)
      const fromUrl = analyzeMediaUrl(abs)
      const info = {
        ...fromUrl,
        isAudioOnly: /\.(mka|aac|mp3)(\?|$)/i.test(abs),
        providerName: 'F2Media',
        providerEmoji: '🎬',
      }
      out.push({
        url: abs,
        ...info,
        label: formatStreamLabel(info),
        badge: qualityBadge(fromUrl.quality),
      })
    }
  }

  const rank = (s) => {
    const q = parseInt(String(s.quality || '').replace(/\D/g, ''), 10) || 0
    return q + (s.hdr ? 50 : 0) + (s.audio === 'dub' ? 5 : 0)
  }
  out.sort((a, b) => rank(b) - rank(a))
  return out.filter((s) => !s.isAudioOnly)
}

export function parseDetailMeta(html, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '')

  const title =
    match1(html, /property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
    match1(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const clean = title ? cleanTitle(stripTags(title)) : undefined
  const year = clean ? extractYear(clean) : extractYear(html.slice(0, 12000))
  const imdb = match1(html, /imdb\.com\/title\/(tt\d+)/i)
  const type = inferType(html.slice(0, 12000) + ' ' + (clean || ''))

  let poster =
    match1(html, /"thumbnailUrl"\s*:\s*"(https?:[^"\\]+)"/i) ||
    match1(html, /"contentUrl"\s*:\s*"(https?:[^"\\]+\.(?:jpg|jpeg|png|webp)[^"\\]*)"/i)
  if (poster) {
    poster = resolveUrl(base, poster) || poster
    if (/public_html|film2med\.top\/jpeg/i.test(poster)) poster = undefined
  }

  let description = match1(html, /"description"\s*:\s*"((?:\\.|[^"\\])+)"/i)
  if (description) {
    description = stripTags(decodeHtml(description)).slice(0, 1500)
    if (isSpamDescription(description)) description = undefined
  }

  return {
    title: clean,
    year: year || undefined,
    imdb: imdb || undefined,
    type,
    poster: poster || undefined,
    description: description || undefined,
  }
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

export function qualityBadge(quality) {
  const q = String(quality || '')
  if (/2160|4K/i.test(q)) return '4K'
  if (/1080/i.test(q)) return '1080p'
  if (/720/i.test(q)) return '720p'
  if (/480/i.test(q)) return '480p'
  if (/360/i.test(q)) return '360p'
  return q || 'HD'
}

/** Unicode LTR embedding — keeps 2160p / HDR / F2Media from scrambling in RTL UI */
const LRE = '\u202A'
const PDF = '\u202C'
function ltr(text) {
  return `${LRE}${text}${PDF}`
}

/**
 * RTL-safe labeled stream card.
 *
 * 🎬 منبع: F2Media
 * 📊 کیفیت: 2160p · HDR · 10bit · BluRay · x265
 * 📝 زیرنویس: زیرنویس چسبیده فارسی
 * 🎧 دوبله: دوبله فارسی
 * 🎞️ انکدر: PSA
 * 📦 سایز: 12.4 GB
 */
export function formatStreamLabel(info = {}) {
  const lines = []
  const emoji = info.providerEmoji || '🎬'
  const provider = info.providerName || 'F2Media'
  lines.push(`${emoji} منبع: ${ltr(provider)}`)

  const tech = []
  if (info.quality) {
    const q = String(info.quality)
    if (/2160|4K/i.test(q)) tech.push('2160p')
    else tech.push(q)
  }
  if (info.hdr) tech.push('HDR')
  if (info.bit10) tech.push('10bit')
  if (info.source) tech.push(info.source)
  if (info.codec) tech.push(info.codec)
  if (tech.length) {
    lines.push(`📊 کیفیت: ${ltr(tech.join(' · '))}`)
  }

  if (info.audio === 'sub') {
    lines.push('📝 زیرنویس: زیرنویس چسبیده فارسی')
  } else if (info.audio === 'dub') {
    lines.push('🎧 دوبله: دوبله فارسی')
  }

  if (info.encoder && !/^unknown$/i.test(info.encoder)) {
    lines.push(`🎞️ انکدر: ${ltr(info.encoder)}`)
  }

  if (info.size) {
    lines.push(`📦 سایز: ${ltr(String(info.size))}`)
  }

  if (info.isAudioOnly) lines.push('🔊 فقط صدا')

  return lines.join('\n')
}

function analyzeMediaUrl(url) {
  const u = String(url)
  const quality = extractQuality(u)
  let audio = null
  if (/\/DUB\/|Farsi\.Dubbed|\bDubbed\b|دوبله/i.test(u)) audio = 'dub'
  else if (/\/SUB\/|Farsi\.Sub|HardSub|hardsub|زیرنویس/i.test(u)) audio = 'sub'

  const source = /BluRay/i.test(u)
    ? 'BluRay'
    : /WEB-?DL/i.test(u)
      ? 'WEB-DL'
      : /WEBRip/i.test(u)
        ? 'WEBRip'
        : /HDTV/i.test(u)
          ? 'HDTV'
          : null
  const codec = /x265|HEVC/i.test(u) ? 'x265' : /x264|AVC/i.test(u) ? 'x264' : null
  const hdr = /\bHDR\b/i.test(u)
  const bit10 = /10bit|10-bit/i.test(u)
  return { quality, audio, source, codec, hdr, bit10 }
}

function analyzeBlockText(block) {
  const text = stripTags(block)
  const quality = extractQuality(text) || (/4\s*K|2160/i.test(text) ? '2160p' : null)
  const size = extractSize(text)
  let audio = null
  if (/دوبله/i.test(text)) audio = 'dub'
  else if (/زیرنویس/i.test(text)) audio = 'sub'
  const source = /BluRay/i.test(text)
    ? 'BluRay'
    : /WEB-?DL/i.test(text)
      ? 'WEB-DL'
      : /WEBRip/i.test(text)
        ? 'WEBRip'
        : null
  const codec = /x265|HEVC/i.test(text) ? 'x265' : /x264/i.test(text) ? 'x264' : null
  const hdr = /\bHDR\b/i.test(text)
  const bit10 = /10\s*bit/i.test(text)
  const encoder = match1(text, /انکودر\s*:?\s*([A-Za-z0-9._\-]+)/i)
  return { quality, size, audio, source, codec, hdr, bit10, encoder }
}

function isSpamDescription(d) {
  const t = String(d || '')
  if (/دانلود فیلم بدون سانسور.*دانلود رایگان فیلم/i.test(t)) return true
  if ((t.match(/دانلود/g) || []).length >= 4) return true
  if (t.length < 40) return true
  return false
}

function isLikelyDetailUrl(abs, base) {
  try {
    const u = new URL(abs)
    const b = new URL(base)
    if (u.origin !== b.origin) return false
    const path = u.pathname.replace(/\/+$/, '')
    if (!path) return false
    if (
      /\/(genres|category|tag|person|persons|profile|login|wp-admin|wp-content|wp-json|movies|series)\b/i.test(
        path,
      )
    ) {
      return false
    }
    if (/\.(css|js|png|jpg|jpeg|webp|gif|svg|ico)(\?|$)/i.test(path)) return false
    const segs = path.split('/').filter(Boolean)
    if (segs.length < 1) return false
    if (/^\d+$/.test(segs[0]) && segs.length >= 2) return true
    if (segs.length >= 1 && /\b(19|20)\d{2}\b/.test(path)) return true
    if (segs.length === 1 && segs[0].length < 20) return false
    return segs.length >= 2
  } catch {
    return false
  }
}

function isNoisePath(pagePath) {
  const p = String(pagePath).replace(/\/+$/, '').toLowerCase()
  const first = p.split('/')[0]
  if (
    /^(movies|series|persons|person|genres|category|profile|login|250tmdb|tmdb|search)$/i.test(
      first,
    )
  ) {
    return true
  }
  if (/^\d+tmdb$/i.test(first)) return true
  return false
}

function isPlayableOrDownloadUrl(abs) {
  try {
    const u = new URL(abs)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const s = abs.toLowerCase()
    if (/[?&]playit=/i.test(s)) return false
    if (/\.(mp4|mkv|m3u8|avi|mov|mka)(\?|$)/i.test(s)) return true
    if (/\/(download|dl|file|stream|video)\b/i.test(s)) return true
    if (/\b(cdn|dl|media|files|abrtech)\b/i.test(u.hostname) && u.pathname.length > 8) {
      return true
    }
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
    const b = new URL(base)
    if (u.origin !== b.origin) return null
    return (u.pathname.replace(/^\/+/, '') + u.search).replace(/\/+$/, '')
  } catch {
    return null
  }
}

function extractTitle(innerHtml) {
  const t =
    match1(innerHtml, /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i) ||
    match1(innerHtml, /title=["']([^"']+)["']/i) ||
    stripTags(innerHtml)
  return t ? cleanTitle(t) : ''
}

function extractTitleNearHref(html, href) {
  const idx = html.indexOf(href)
  if (idx < 0) return ''
  return extractTitle(html.slice(Math.max(0, idx - 200), idx + 400))
}

function extractImg(innerHtml) {
  return (
    match1(innerHtml, /<img[^>]+src=["']([^"']+)["']/i) ||
    match1(innerHtml, /data-src=["']([^"']+)["']/i) ||
    undefined
  )
}

function extractYear(text) {
  const m = String(text).match(/\b(19|20)\d{2}\b/)
  return m ? Number(m[0]) : null
}

function extractQuality(text) {
  const t = String(text)
  if (/\b2160p\b|\b4K\b/i.test(t)) return '2160p'
  const m = t.match(/\b(1080p|720p|480p|360p)\b/i)
  return m ? m[1] : null
}

function extractSize(text) {
  const m = String(text).match(/\b(\d+(?:\.\d+)?\s*(?:GB|MB|گیگابایت|مگابایت|گیگ|مگ))\b/i)
  if (!m) return null
  return m[1]
    .replace(/گیگابایت/i, 'GB')
    .replace(/مگابایت/i, 'MB')
    .replace(/گیگ/i, 'GB')
    .replace(/مگ/i, 'MB')
}

function inferType(text) {
  const t = String(text).toLowerCase()
  if (/سریال|series|season|episode|فصل|قسمت|\btv\b/i.test(t)) return 'series'
  return 'movie'
}

function isNoiseTitle(title) {
  const t = title.trim()
  if (t.length < 2 || t.length > 200) return true
  if (
    /^(صفحه|خانه|ورود|ثبت|جستجو|دسته‌|ژانر|فیلم\s*ها|سریال\s*ها|بازیگران|home|login|search|menu|next|prev)$/i.test(
      t,
    )
  ) {
    return true
  }
  if (/^\d+\s*فیلم\s*برتر/i.test(t)) return true
  if (/^250\s*فیلم/i.test(t)) return true
  return false
}

function cleanTitle(t) {
  return stripTags(t)
    .replace(/دانلود\s*(فیلم|سریال|انیمه|کالکشن)?/gi, '')
    .replace(/بدون\s*سانسور.*$/gi, '')
    .replace(/با\s*زیرنویس.*$/gi, '')
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
