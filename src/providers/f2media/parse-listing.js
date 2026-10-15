/**
 * Parse F2Media listing pages (homepage rails, /movies/, /series/, /category/…).
 */

import { encodePageId, decodePageId } from './parse.js'

/**
 * @returns {Array<{ itemId: string, title: string, year?: number, type: 'movie'|'series', poster?: string, pagePath: string }>}
 */
export function parseListingHtml(html, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const results = []
  const seen = new Set()

  // Primary: stretched-link + entry-title (homepage + archives)
  const cardRe =
    /<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*stretched-link[^"']*["'][^>]*>[\s\S]*?<h2[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/gi

  let m
  while ((m = cardRe.exec(html)) !== null) {
    const abs = resolveUrl(base, m[1])
    if (!abs || !isContentUrl(abs, base)) continue
    const title = cleanTitle(stripTags(m[2]))
    if (!title || title.length < 2) continue

    const pagePath = pathFromUrl(abs, base)
    if (!pagePath || seen.has(pagePath)) continue
    seen.add(pagePath)

    // poster: look backward in article for img
    const start = Math.max(0, m.index - 1200)
    const slice = html.slice(start, m.index + 50)
    let poster = match1(slice, /<img[^>]+src=["']([^"']+)["']/i)
    if (poster && poster.startsWith('./')) poster = undefined
    if (poster) poster = resolveUrl(base, poster) || poster

    const year = extractYear(title) || extractYear(slice)
    const type = /\/series\//i.test(abs) ? 'series' : 'movie'

    results.push({
      itemId: encodePageId(pagePath),
      title,
      year: year || undefined,
      type,
      poster: poster || undefined,
      pagePath,
    })
    if (results.length >= 60) break
  }

  // Fallback: any /{id}/{slug}/ or /series/{slug}/ with nearby title
  if (results.length === 0) {
    const linkRe =
      /<a[^>]+href=["'](https?:\/\/[^"']+|\/[^"']+)["'][^>]*>[\s\S]{0,300}?<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi
    while ((m = linkRe.exec(html)) !== null) {
      const abs = resolveUrl(base, m[1])
      if (!abs || !isContentUrl(abs, base)) continue
      const title = cleanTitle(stripTags(m[2]))
      if (!title) continue
      const pagePath = pathFromUrl(abs, base)
      if (!pagePath || seen.has(pagePath)) continue
      seen.add(pagePath)
      results.push({
        itemId: encodePageId(pagePath),
        title,
        year: extractYear(title) || undefined,
        type: /\/series\//i.test(abs) ? 'series' : 'movie',
        pagePath,
      })
      if (results.length >= 40) break
    }
  }

  return results
}

/** Extract one homepage carousel rail by index (1-based) */
export function parseHomeRail(html, baseUrl, railIndex) {
  const start = html.indexOf(`id="carougsel-posts${railIndex}"`)
  if (start < 0) return parseListingHtml(html, baseUrl)
  const next = html.indexOf(`id="carougsel-posts${railIndex + 1}"`, start + 10)
  const chunk = next > start ? html.slice(start, next) : html.slice(start, start + 50000)
  return parseListingHtml(chunk, baseUrl)
}

function isContentUrl(abs, base) {
  try {
    const u = new URL(abs)
    const b = new URL(base)
    if (u.origin !== b.origin) return false
    const path = u.pathname.replace(/\/+$/, '')
    if (/\/(genres|category|tag|person|profile|login|movies|series)\/?$/i.test(path)) return false
    if (/\/series\/[a-z0-9\-]+$/i.test(path)) return true
    // /12345/slug
    if (/\/\d+\/[a-z0-9\-]+$/i.test(path)) return true
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

function extractYear(text) {
  const m = String(text).match(/\b(19|20)\d{2}\b/)
  return m ? Number(m[0]) : null
}

function cleanTitle(t) {
  return String(t)
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
    .replace(/\s+/g, ' ')
    .trim()
}

function match1(s, re) {
  const m = String(s).match(re)
  return m ? m[1] : null
}

export { decodePageId }
