/**
 * AvaMovie poster helpers.
 *
 * Listing cards use background-image on avadel.top/cdn/... which is often
 * unreachable without session / from Stremio clients. Those files are usually
 * Amazon/IMDb assets (MV5B… keys) — rewrite to m.media-amazon.com (public).
 *
 * Same idea as F2Media/intocdn: prefer a public CDN URL extracted from HTML.
 */

const AMAZON_MEDIA = 'https://m.media-amazon.com/images/M'

/**
 * Normalize a raw poster URL from Ava HTML into a client-loadable absolute URL.
 */
export function normalizeAvaPosterUrl(raw, baseUrl) {
  if (!raw) return undefined
  let s = String(raw).trim().replace(/^['"]|['"]$/g, '')
  if (!s || s.startsWith('data:')) return undefined

  if (s.startsWith('//')) s = 'https:' + s

  // Amazon key embedded in Ava CDN path
  const amazonKey = s.match(
    /(MV5B[A-Za-z0-9_@.,%-]+\._V1_[^/"'?\s]+\.(?:jpg|jpeg|png|webp))/i,
  )
  if (amazonKey) {
    return `${AMAZON_MEDIA}/${amazonKey[1]}`
  }

  // Bare MV5B filename
  const bare = s.match(
    /^(MV5B[A-Za-z0-9_@.,%-]+\._V1_[^/"'?\s]+\.(?:jpg|jpeg|png|webp))$/i,
  )
  if (bare) {
    return `${AMAZON_MEDIA}/${bare[1]}`
  }

  try {
    const abs = new URL(s, baseUrl || 'https://avadel.top/').toString()
    // Still on Ava host without Amazon key — often needs cookie; drop for clients
    if (/avadel\.top|avamovie\.shop/i.test(abs)) {
      return undefined
    }
    if (/\.(jpe?g|png|webp)(\?|$)/i.test(abs) && !/svg|icon|logo|sprite/i.test(abs)) {
      return abs
    }
  } catch {
    return undefined
  }
  return undefined
}

export function extractPosterFromCardHtml(block, baseUrl) {
  const candidates = []
  const bg = match1(block, /background-image:\s*url\(([^)]+)\)/i)
  if (bg) candidates.push(bg.replace(/^['"]|['"]$/g, '').trim())
  const img = match1(block, /<img[^>]+src=["']([^"']+)["']/i)
  if (img) candidates.push(img)
  const data = match1(block, /data-src=["']([^"']+)["']/i)
  if (data) candidates.push(data)

  for (const c of candidates) {
    const n = normalizeAvaPosterUrl(c, baseUrl)
    if (n) return n
  }
  return undefined
}

function match1(s, re) {
  const m = String(s).match(re)
  return m ? m[1] : null
}
