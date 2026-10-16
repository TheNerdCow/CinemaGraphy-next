/**
 * Parse F2Media listing pages (homepage rails, /movies/, /series/, /category/…).
 * Accepts myf2ms / film2med mirror hosts (path is what matters).
 */

import { encodePageId } from './parse.js'
import { extractPosterNearCard } from './poster.js'

const F2_HOST_RE = /(?:^|\.)(myf2ms|film2med|f2media|film2media)\./i

export function parseListingHtml(html, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const results = []
  const seen = new Set()

  function pushItem({ abs, title, poster, year, type }) {
    if (!abs) return
    if (!isContentUrl(abs, base)) return
    const pagePath = pathFromUrl(abs, base)
    if (!pagePath || seen.has(pagePath)) return
    const t = cleanTitle(title || '')
    if (!t || t.length < 2) return
    seen.add(pagePath)
    results.push({
      itemId: encodePageId(pagePath),
      title: t,
      year: year || extractYear(t) || undefined,
      type: type || (/\/series\//i.test(abs) ? 'series' : 'movie'),
      poster: poster || undefined,
      pagePath,
    })
  }

  // Strategy A — classic card
  const cardRe =
    /<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*stretched-link[^"']*["'][^>]*>[\s\S]*?<h2[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/gi
  let m
  while ((m = cardRe.exec(html)) !== null) {
    const abs = resolveUrl(base, m[1])
    const start = Math.max(0, m.index - 1500)
    const slice = html.slice(start, m.index + 80)
    pushItem({
      abs,
      title: stripTags(m[2]),
      poster: extractPosterNearCard(slice, base),
      year: extractYear(m[2]) || extractYear(slice),
      type: /\/series\//i.test(abs || '') ? 'series' : 'movie',
    })
    if (results.length >= 60) break
  }

  // Strategy B — link then h2/h3
  if (results.length < 8) {
    const linkTitleRe =
      /<a[^>]+href=["'](https?:\/\/[^"']+|\/[^"']+)["'][^>]*>[\s\S]{0,500}?<h([23])[^>]*>([\s\S]*?)<\/h\2>/gi
    while ((m = linkTitleRe.exec(html)) !== null) {
      const abs = resolveUrl(base, m[1])
      pushItem({
        abs,
        title: stripTags(m[3]),
        type: /\/series\//i.test(abs || '') ? 'series' : 'movie',
      })
      if (results.length >= 60) break
    }
  }

  // Strategy C — h2/h3 then nearby content href
  if (results.length < 8) {
    const hRe = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi
    while ((m = hRe.exec(html)) !== null) {
      const title = stripTags(m[2])
      if (!title || title.length < 2) continue
      const window = html.slice(Math.max(0, m.index - 3000), m.index + 800)
      const href =
        match1(
          window,
          /href=["']((?:https?:\/\/[^"']+|\/)(?:\d+\/[a-z0-9\-]+|series\/[a-z0-9\-]+)[^"']*)["']/i,
        ) ||
        match1(window, /href=["']((?:https?:\/\/[^"']+|\/)[^"']+)["'][^>]*class=["'][^"']*stretched/i)
      if (!href) continue
      const abs = resolveUrl(base, href)
      pushItem({
        abs,
        title,
        poster: extractPosterNearCard(window, base),
        type: /\/series\//i.test(abs || '') ? 'series' : 'movie',
      })
      if (results.length >= 60) break
    }
  }

  // Strategy D — every /{digits}/{slug} anchor
  if (results.length < 8) {
    const bareRe =
      /<a[^>]+href=["']((?:https?:\/\/[^"']+|\/)(?:\d+\/[a-z0-9\-]+(?:\/[^"']*)?))["'][^>]*>([\s\S]*?)<\/a>/gi
    while ((m = bareRe.exec(html)) !== null) {
      const abs = resolveUrl(base, m[1])
      let title = cleanTitle(stripTags(m[2]))
      if (!title || title.length < 3) {
        title = cleanTitle(
          match1(m[0], /title=["']([^"']+)["']/i) ||
            match1(
              html.slice(Math.max(0, m.index - 300), m.index + 500),
              /<h[23][^>]*>([\s\S]*?)<\/h[23]>/i,
            ) ||
            '',
        )
      }
      if (!title) continue
      if (/^(دانلود مستقیم|بیشتر|مشاهده|next|prev|صفحه)$/i.test(title)) continue
      pushItem({
        abs,
        title,
        type: /\/series\//i.test(abs || '') ? 'series' : 'movie',
      })
      if (results.length >= 60) break
    }
  }

  // Strategy E — bare href inventory (title from path slug)
  if (results.length < 4) {
    const hrefOnly =
      /href=["']((?:https?:\/\/[^"']+|\/)\d+\/([a-z0-9\-]+)(?:\/[^"']*)?)["']/gi
    while ((m = hrefOnly.exec(html)) !== null) {
      const abs = resolveUrl(base, m[1])
      const slug = m[2] || ''
      const title = slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
      pushItem({
        abs,
        title,
        type: /\/series\//i.test(abs || '') ? 'series' : 'movie',
      })
      if (results.length >= 40) break
    }
  }

  return results
}

export function parseHomeRail(html, baseUrl, railIndex) {
  const markers = [
    `id="carougsel-posts${railIndex}"`,
    `id='carougsel-posts${railIndex}'`,
    `id="carousel-posts${railIndex}"`,
    `data-rail="${railIndex}"`,
  ]
  let start = -1
  for (const mk of markers) {
    start = html.indexOf(mk)
    if (start >= 0) break
  }
  if (start < 0) return parseListingHtml(html, baseUrl)
  const nextIdx = railIndex + 1
  let next = -1
  for (const mk of [
    `id="carougsel-posts${nextIdx}"`,
    `id='carougsel-posts${nextIdx}'`,
    `id="carousel-posts${nextIdx}"`,
  ]) {
    next = html.indexOf(mk, start + 10)
    if (next > start) break
  }
  const chunk = next > start ? html.slice(start, next) : html.slice(start, start + 80000)
  return parseListingHtml(chunk, baseUrl)
}

function isF2Host(hostname) {
  const h = String(hostname || '').toLowerCase()
  return F2_HOST_RE.test(h) || h.includes('myf2ms') || h.includes('film2med')
}

function isContentUrl(abs, base) {
  try {
    const u = new URL(abs)
    const b = new URL(base)
    if (u.origin !== b.origin && !isF2Host(u.hostname)) return false
    const path = u.pathname.replace(/\/+$/, '')
    if (/\/(genres|category|tag|person|profile|login|movies|series)\/?$/i.test(path)) return false
    if (/\/series\/[a-z0-9\-]+$/i.test(path)) return true
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

/** Prefer path relative to configured base (mirrors share paths). */
function pathFromUrl(abs, base) {
  try {
    const u = new URL(abs)
    const b = new URL(base)
    if (u.origin !== b.origin && !isF2Host(u.hostname)) return null
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
