/**
 * Extract and normalize F2Media / IntoCDN poster URLs.
 * Prefer site CDN over metahub (often blocked or empty in IR).
 */

const INTOCDN = 'https://intocdn.top'

export function extractPosterFromHtml(html, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '')

  const candidates = []

  // Schema / JSON-LD (most reliable on detail pages)
  push(candidates, match1(html, /"thumbnailUrl"\s*:\s*"(https?:[^"\\]+)"/i))
  push(candidates, match1(html, /"contentUrl"\s*:\s*"(https?:[^"\\]+\.(?:jpg|jpeg|png|webp)[^"\\]*)"/i))

  // Cover image used on detail hero
  push(candidates, match1(html, /class=["'][^"']*mb-coverimg[^"']*["'][^>]+src=["']([^"']+)["']/i))
  push(candidates, match1(html, /src=["']([^"']+)["'][^>]+class=["'][^"']*mb-coverimg/i))

  // Listing cards
  push(candidates, match1(html, /class=["'][^"']*wp-post-image[^"']*["'][^>]+src=["']([^"']+)["']/i))
  push(candidates, match1(html, /src=["']([^"']+)["'][^>]+class=["'][^"']*wp-post-image/i))
  push(candidates, match1(html, /data-src=["']([^"']+)["']/i))

  // og:image last — often broken path on this site
  push(candidates, match1(html, /property=["']og:image["'][^>]*content=["']([^"']+)["']/i))

  for (const raw of candidates) {
    const n = normalizePosterUrl(raw, base)
    if (n) return n
  }
  return undefined
}

export function extractPosterNearCard(htmlSlice, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const srcs = [
    ...all(htmlSlice, /src=["']([^"']+)["']/gi),
    ...all(htmlSlice, /data-src=["']([^"']+)["']/gi),
  ]
  for (const s of srcs) {
    const n = normalizePosterUrl(s, base)
    if (n) return n
  }
  return undefined
}

export function normalizePosterUrl(raw, baseUrl) {
  if (!raw) return undefined
  let s = String(raw).trim()
  if (!s || s.startsWith('data:')) return undefined

  // Broken local save paths from "Save as"
  if (s.includes('_files/')) {
    const name = s.split('/').pop()
    if (name && /\.(jpe?g|png|webp)$/i.test(name)) {
      // cannot recover full uploads path — drop
      return undefined
    }
  }

  // Broken og:image with public_html junk
  if (/public_html|film2med\.top\/jpeg/i.test(s)) return undefined

  // Protocol-relative
  if (s.startsWith('//')) s = 'https:' + s

  try {
    const abs = new URL(s, baseUrl || INTOCDN).toString()
    // Prefer intocdn / film2med uploads
    if (/intocdn\.top/i.test(abs)) return abs
    if (/\/wp-content\/uploads\//i.test(abs) && /\.(jpe?g|png|webp)(\?|$)/i.test(abs)) {
      return abs
    }
    if (/\.(jpe?g|png|webp)(\?|$)/i.test(abs) && !/svg|icon|logo|sprite/i.test(abs)) {
      return abs
    }
  } catch {
    return undefined
  }
  return undefined
}

function push(arr, v) {
  if (v) arr.push(v)
}

function match1(s, re) {
  const m = String(s).match(re)
  return m ? m[1] : null
}

function all(s, re) {
  const out = []
  let m
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  while ((m = r.exec(s)) !== null) out.push(m[1])
  return out
}
