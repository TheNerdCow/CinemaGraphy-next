/**
 * Strict title matching — avoid Cinemeta false positives (Family Guy on Korean rows).
 */

export function normalizeTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\u200c\u200f\u202a-\u202e]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Token set without tiny words */
function tokens(s) {
  return normalizeTitle(s)
    .split(' ')
    .filter((t) => t.length > 1 && !/^(the|and|of|a|an|season|series|movie|film)$/i.test(t))
}

/**
 * Accept Cinemeta hit only if titles are clearly the same work.
 */
export function isStrictTitleMatch(siteTitle, cinemetaName, siteYear) {
  if (!siteTitle || !cinemetaName) return false
  const a = normalizeTitle(siteTitle)
  const b = normalizeTitle(cinemetaName)
  if (!a || !b) return false

  // Exact or containment of full normalized string (min length)
  if (a === b) return true
  if (a.length >= 6 && b.length >= 6 && (a.includes(b) || b.includes(a))) return true

  const ta = new Set(tokens(siteTitle))
  const tb = tokens(cinemetaName)
  if (ta.size === 0 || tb.length === 0) return false

  let hit = 0
  for (const t of tb) {
    if (ta.has(t)) hit++
  }
  const ratio = hit / Math.max(tb.length, ta.size)
  // Require strong overlap
  if (ratio < 0.7) return false
  if (hit < 2 && Math.max(a.length, b.length) > 12) return false

  // Year: if both known and differ by >1, reject
  if (siteYear) {
    const y = parseInt(String(siteYear), 10)
    const cy = parseInt(String(cinemetaName).match(/\b(19|20)\d{2}\b/)?.[0] || '', 10)
    // year often only on site title
    if (y && cy && Math.abs(y - cy) > 1) return false
  }

  return true
}
