/**
 * Title matching — strict for replacing names; softer for posters only.
 */

export function normalizeTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\u200c\u200f\u202a-\u202e]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(s) {
  return normalizeTitle(s)
    .split(' ')
    .filter((t) => t.length > 1 && !/^(the|and|of|a|an|season|series|movie|film|part|vol)$/i.test(t))
}

/** Hard match — safe to trust name/plot from external meta */
export function isStrictTitleMatch(siteTitle, externalName, siteYear) {
  if (!siteTitle || !externalName) return false
  const a = normalizeTitle(siteTitle)
  const b = normalizeTitle(externalName)
  if (!a || !b) return false
  if (a === b) return true
  if (a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a))) return true

  const ta = new Set(tokens(siteTitle))
  const tb = tokens(externalName)
  if (ta.size === 0 || tb.length === 0) return false
  let hit = 0
  for (const t of tb) if (ta.has(t)) hit++
  const ratio = hit / Math.max(tb.length, ta.size)
  if (ratio < 0.7) return false
  if (hit < 2 && Math.max(a.length, b.length) > 12) return false
  return true
}

/** Softer — only for attaching poster/background, never for renaming */
export function isPosterMatch(siteTitle, externalName, siteYear, externalYear) {
  if (isStrictTitleMatch(siteTitle, externalName, siteYear)) return true
  if (!siteTitle || !externalName) return false

  const ta = tokens(siteTitle)
  const tb = tokens(externalName)
  if (ta.length === 0 || tb.length === 0) return false

  const setA = new Set(ta)
  let hit = 0
  for (const t of tb) if (setA.has(t)) hit++
  const ratio = hit / Math.max(tb.length, ta.length)

  // year helps a lot for soft match
  const y1 = siteYear ? Number(siteYear) : null
  const y2 = externalYear ? parseInt(String(externalYear).slice(0, 4), 10) : null
  const yearOk = y1 && y2 ? Math.abs(y1 - y2) <= 1 : true

  if (ratio >= 0.5 && hit >= 1 && yearOk) return true
  if (ratio >= 0.4 && hit >= 2 && yearOk) return true
  return false
}
