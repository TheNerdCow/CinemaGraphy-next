/**
 * F2Media HTML parsers — independent implementation from observed public pages.
 * Search: GET /?s=query
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
    const poster = extractImg(a.inner)
    const pagePath = pathFromUrl(abs, base)
    if (!pagePath || seen.has(pagePath)) continue
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

  if (results.length === 0) {
    const hRe = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi
    while ((m = hRe.exec(html)) !== null) {
      const raw = stripTags(m[1]).trim()
      if (!raw || isNoiseTitle(raw)) continue
      const title = cleanTitle(raw)
      const year = extractYear(title)
      const type = inferType(raw)
      const fakePath = `search-hit/${slugify(title)}`
      if (seen.has(fakePath)) continue
      seen.add(fakePath)
      results.push({
        itemId: encodePageId(fakePath),
        title,
        year: year || undefined,
        type,
        pagePath: fakePath,
      })
      if (results.length >= 20) break
    }
  }

  return results
}

export function parseDetailStreams(html, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const out = []
  const seen = new Set()
  const aRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = aRe.exec(html)) !== null) {
    const href = m[1]
    const inner = stripTags(m[2]).trim()
    const abs = resolveUrl(base, href)
    if (!abs) continue
    if (!isPlayableOrDownloadUrl(abs)) continue
    if (seen.has(abs)) continue
    seen.add(abs)
    const quality = extractQuality(inner + ' ' + abs)
    const size = extractSize(inner)
    out.push({
      url: abs,
      quality: quality || undefined,
      size: size || undefined,
      label: inner.slice(0, 120) || quality || 'stream',
    })
    if (out.length >= 50) break
  }
  return out
}

export function parseDetailMeta(html) {
  const title =
    match1(html, /property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
    match1(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const clean = title ? cleanTitle(stripTags(title)) : undefined
  const year = clean ? extractYear(clean) : extractYear(html.slice(0, 5000))
  const imdb = match1(html, /imdb\.com\/title\/(tt\d+)/i)
  const type = inferType(html.slice(0, 8000) + ' ' + (clean || ''))
  return { title: clean, year: year || undefined, imdb: imdb || undefined, type }
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

function isLikelyDetailUrl(abs, base) {
  try {
    const u = new URL(abs)
    const b = new URL(base)
    if (u.origin !== b.origin) return false
    const path = u.pathname.replace(/\/+$/, '')
    if (!path) return false
    if (/\/(genres|category|tag|person|profile|login|wp-admin|wp-content|wp-json)\b/i.test(path)) return false
    if (/\.(css|js|png|jpg|jpeg|webp|gif|svg|ico)(\?|$)/i.test(path)) return false
    if (path.split('/').filter(Boolean).length < 1) return false
    return true
  } catch {
    return false
  }
}

function isPlayableOrDownloadUrl(abs) {
  try {
    const u = new URL(abs)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const s = abs.toLowerCase()
    if (/\.(mp4|mkv|m3u8|avi|mov)(\?|$)/i.test(s)) return true
    if (/\/(download|dl|file|stream|video)\b/i.test(s)) return true
    if (/\b(cdn|dl|media|files)\b/i.test(u.hostname) && u.pathname.length > 5) return true
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
  const slice = html.slice(Math.max(0, idx - 200), idx + 400)
  return extractTitle(slice)
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
  const m = String(text).match(/\b(2160p|1080p|720p|480p|360p|4K|8K)\b/i)
  return m ? m[1].toUpperCase().replace('4K', '2160p') : null
}

function extractSize(text) {
  const m = String(text).match(/\b(\d+(?:\.\d+)?\s*(?:GB|MB|گیگ|مگ))\b/i)
  return m ? m[1] : null
}

function inferType(text) {
  const t = String(text).toLowerCase()
  if (/سریال|series|season|episode|فصل|قسمت|\btv\b/i.test(t)) return 'series'
  return 'movie'
}

function isNoiseTitle(title) {
  const t = title.trim()
  if (t.length < 2 || t.length > 200) return true
  return /^(صفحه|خانه|ورود|ثبت|جستجو|دسته‌|ژانر|home|login|search|menu|next|prev)/i.test(t)
}

function cleanTitle(t) {
  return stripTags(t)
    .replace(/دانلود\s*(فیلم|سریال|انیمه)?/gi, '')
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

function match1(s, re) {
  const m = String(s).match(re)
  return m ? m[1] : null
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}
