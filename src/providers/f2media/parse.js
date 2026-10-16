/**
 * F2Media parsers — real page structure (download-list + full media link scan).
 */

import {
  qualityBadge,
  formatStreamLabel,
  analyzeMediaUrl,
  extractQuality,
} from './parse-streams-shared.js'

export { qualityBadge, formatStreamLabel }

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

/**
 * Collect ALL playable download links on a detail page.
 * Previous bug: download-list blocks were truncated to 4000 chars → missed 720p/480p.
 */
export function parseDetailStreams(html, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const out = []
  const seen = new Set()

  // 1) Prefer structured download-list sections (full section, no char cap)
  const sectionRe = /class=["']([^"']*download-list[^"']*)["'][^>]*>([\s\S]*?)(?=<div[^>]+class=["'][^"']*download-list|class=["'][^"']*download-list|$)/gi
  let sm
  while ((sm = sectionRe.exec(html)) !== null) {
    const className = sm[1] || ''
    const block = sm[0]
    const sectionAudio = /dubbled|4dub|\bdub\b|دوبله/i.test(className + block.slice(0, 200))
      ? 'dub'
      : /hardsub|rsub|\bsub\b|زیرنویس/i.test(className + block.slice(0, 200))
        ? 'sub'
        : null
    collectLinksFromHtml(block, base, out, seen, sectionAudio)
  }

  // 2) Always full-page pass — catches links outside truncated/old markup
  collectLinksFromHtml(html, base, out, seen, null)

  const rank = (s) => {
    const q = parseInt(String(s.quality || '').replace(/\D/g, ''), 10) || 0
    return q + (s.hdr ? 50 : 0) + (s.audio === 'dub' ? 5 : 0)
  }
  out.sort((a, b) => rank(b) - rank(a))
  return out.filter((s) => !s.isAudioOnly)
}

function collectLinksFromHtml(html, base, out, seen, sectionAudio) {
  const aRe = /<a[^>]+href=["']([^"']+)["'][^>]*(?:>([\s\S]*?)<\/a>|(?:\s*\/>))/gi
  let am
  while ((am = aRe.exec(html)) !== null) {
    const href = decodeHtml(am[1])
    const abs = resolveUrl(base, href)
    if (!abs || !isPlayableOrDownloadUrl(abs)) continue
    if (seen.has(abs)) continue

    const isAudioOnly = /\.(mka|aac|mp3)(\?|$)/i.test(abs)
    seen.add(abs)

    // Local context around this link for quality/size (not the whole page)
    const start = Math.max(0, am.index - 400)
    const local = html.slice(start, am.index + (am[0]?.length || 0) + 80)
    const localText = stripTags(local) + ' ' + stripTags(am[2] || '')

    const fromUrl = analyzeMediaUrl(abs)
    const quality = fromUrl.quality || extractQuality(localText)
    const size = extractSize(localText)
    const audio =
      fromUrl.audio ||
      sectionAudio ||
      (/دوبله/i.test(localText) ? 'dub' : /زیرنویس/i.test(localText) ? 'sub' : null)
    const source =
      fromUrl.source ||
      (/BluRay/i.test(localText)
        ? 'BluRay'
        : /WEB-?DL/i.test(localText)
          ? 'WEB-DL'
          : /WEBRip/i.test(localText)
            ? 'WEBRip'
            : null)
    const codec =
      fromUrl.codec || (/x265|HEVC/i.test(localText) ? 'x265' : /x264/i.test(localText) ? 'x264' : null)
    const hdr = fromUrl.hdr || /\bHDR\b/i.test(localText)
    const bit10 = fromUrl.bit10 || /10\s*bit/i.test(localText)
    const encoder =
      fromUrl.encoder ||
      match1(localText, /انکودر\s*:?\s*([A-Za-z0-9._\-]+)/i)

    const info = {
      quality,
      size,
      audio,
      source,
      codec,
      hdr: Boolean(hdr),
      bit10: Boolean(bit10),
      encoder: encoder && !/^unknown$/i.test(encoder) ? encoder : undefined,
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
    if (/public_html|film2med\.top\/jpeg|myf2ms\.top\/jpeg/i.test(poster)) poster = undefined
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
    if (
      /\b(cdn|dl|media|files|abrtech)\b/i.test(u.hostname) &&
      u.pathname.length > 8
    ) {
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
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtml(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function match1(s, re) {
  const m = String(s).match(re)
  return m ? m[1] : null
}
