/**
 * ZardFilm HTML parsers — listing cards, detail meta, download streams.
 * Prefer direct media hosts; keep gapfilm links as fallback.
 */

import {
  qualityBadge,
  extractQuality,
} from '../f2media/parse-streams-shared.js'

export function encodePageId(pagePath) {
  return Buffer.from(String(pagePath), 'utf8').toString('base64url')
}

export function decodePageId(itemId) {
  try {
    const raw = String(itemId || '')
    if (!/^[A-Za-z0-9_-]+$/.test(raw)) return null
    const p = Buffer.from(raw, 'base64url').toString('utf8')
    if (!p || p.includes('..') || p.includes('://')) return null
    return p.replace(/^\/+/, '')
  } catch {
    return null
  }
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function stripTags(s) {
  return decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function cleanTitle(raw) {
  let t = stripTags(raw)
  t = t
    .replace(/^دانلود\s+(?:و\s+تماشای\s+)?(?:فیلم|سریال|انیمیشن|انیمه|کارتون)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return t
}

function extractYear(text) {
  const m = String(text || '').match(/\b(19|20)\d{2}\b/)
  return m ? Number(m[0]) : null
}

function resolveUrl(base, href) {
  if (!href) return null
  const h = decodeEntities(href).trim()
  if (!h || h.startsWith('#') || h.startsWith('javascript:')) return null
  try {
    return new URL(h, base).href
  } catch {
    return null
  }
}

function absPoster(base, src) {
  if (!src) return null
  let s = decodeEntities(src).trim()
  if (s.includes('_files/')) {
    const name = s.split('/').pop()
    if (name) s = `https://zardfilm.in/wp-content/uploads/${name}`
  }
  if (s.startsWith('//')) s = 'https:' + s
  try {
    return new URL(s, base).href
  } catch {
    return null
  }
}

function match1(s, re) {
  const m = String(s || '').match(re)
  return m ? m[1] : null
}

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Listing: article.zc cards with /movie/{slug}/
 * @param {'movie'|'series'|null} forceType
 */
export function parseListingHtml(html, baseUrl, forceType = null) {
  const base = String(baseUrl || 'https://zardfilm.in').replace(/\/+$/, '')
  const results = []
  const seen = new Set()

  const articleRe = /<article[^>]*class="[^"]*\bzc\b[^"]*"[^>]*>([\s\S]*?)<\/article>/gi
  let m
  while ((m = articleRe.exec(html)) !== null) {
    const block = m[0]
    const hrefM = block.match(/href=["']((?:https?:\/\/[^"']+)?\/movie\/[^"'#]+)["']/i)
    if (!hrefM) continue
    const abs = resolveUrl(base, hrefM[1])
    if (!abs || !abs.includes('/movie/')) continue
    let pagePath
    try {
      pagePath = new URL(abs).pathname.replace(/^\/+/, '').replace(/\/+$/, '')
    } catch {
      continue
    }
    if (!pagePath.startsWith('movie/')) continue
    if (seen.has(pagePath)) continue

    const en = block.match(/class="zc-en"[^>]*>[\s\S]*?<span>([^<]+)<\/span>[\s\S]*?<b>(\d{4})<\/b>/i)
    const fa = block.match(/class="zc-fa"[^>]*>([^<]+)</i)
    let title = en ? en[1].trim() : fa ? fa[1].trim() : null
    if (!title) {
      const alt = block.match(/alt=["']([^"']+)["']/i)
      title = alt ? cleanTitle(alt[1]) : null
    }
    if (!title || title.length < 2) continue

    const year = en ? Number(en[2]) : extractYear(block) || extractYear(title)
    const imgM = block.match(/<img[^>]+src=["']([^"']+)["']/i)
    const poster = imgM ? absPoster(base, imgM[1]) : null

    const isSeriesHint =
      /series|سریال|انیمه/i.test(pagePath + ' ' + block + ' ' + title)
    const type = forceType || (isSeriesHint ? 'series' : 'movie')

    seen.add(pagePath)
    results.push({
      itemId: encodePageId(pagePath),
      pagePath,
      type,
      title: cleanTitle(title),
      year,
      poster,
    })
  }

  if (!results.length) {
    const linkRe = /href=["']((?:https?:\/\/[^"']+)?\/movie\/([^"'/#]+))\/?["']/gi
    while ((m = linkRe.exec(html)) !== null) {
      const slug = m[2]
      if (!slug || slug === 'feed' || slug === 'page') continue
      const pagePath = `movie/${decodeURIComponent(slug)}`
      if (seen.has(pagePath)) continue
      const window = html.slice(Math.max(0, m.index - 300), m.index + 500)
      const title =
        cleanTitle(match1(window, /(?:alt|title)=["']([^"']{4,120})["']/i) || '') ||
        cleanTitle(slug.replace(/-/g, ' '))
      if (!title) continue
      seen.add(pagePath)
      results.push({
        itemId: encodePageId(pagePath),
        pagePath,
        type: forceType || (/series|سریال/i.test(window + slug) ? 'series' : 'movie'),
        title,
        year: extractYear(window) || extractYear(title),
        poster: absPoster(base, match1(window, /src=["']([^"']+\.(?:webp|jpg|png))["']/i)),
      })
    }
  }

  return results
}

export function parseSearchHtml(html, baseUrl) {
  return parseListingHtml(html, baseUrl, null)
}

export function parseDetailMeta(html, baseUrl, pagePath) {
  const base = String(baseUrl || 'https://zardfilm.in').replace(/\/+$/, '')
  const ogTitle = match1(html, /property="og:title" content="([^"]+)"/i)
  const h1 = match1(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
  // Prefer canonical title fields — ignore related-card zc-en blocks elsewhere on the page.
  let title = cleanTitle(ogTitle || h1 || '')

  const year =
    extractYear(ogTitle || '') ||
    extractYear(h1 || '') ||
    extractYear(match1(html, /<title>([^<]+)<\/title>/i) || '') ||
    null

  let imdb =
    match1(html, /imdb\.com\/title\/(tt\d{5,})/i) ||
    match1(html, /\b(tt\d{7,})\b/)
  if (imdb) imdb = imdb.toLowerCase()

  const poster =
    absPoster(base, match1(html, /property="og:image" content="([^"]+)"/i)) ||
    absPoster(
      base,
      match1(html, /src=["'](https:\/\/zardfilm\.in\/wp-content\/uploads\/[^"']+\.(?:webp|jpg|png))["']/i),
    )

  const headHints = `${ogTitle || ''} ${h1 || ''} ${pagePath || ''}`
  const isSeries =
    /دانلود\s*سریال|\bseries\b/i.test(headHints) ||
    (/دانلود\s*قسمت/i.test(html) && !/دانلود\s*فیلم/i.test(headHints))

  return {
    title: title || pagePath,
    year,
    imdb,
    poster,
    type: isSeries ? 'series' : 'movie',
    pagePath,
  }
}

/**
 * Extract playable streams from detail HTML.
 */
export function parseDetailStreams(html) {
  const streams = []
  const seen = new Set()

  const aRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = aRe.exec(html)) !== null) {
    let href = decodeEntities(m[1]).trim()
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue
    const text = stripTags(m[2] || '')
    const isMedia =
      /\.(mkv|mp4|m3u8|avi|webm)(\?|$)/i.test(href) ||
      /gapfilm\.ir\/(?:download|stream)\//i.test(href) ||
      /upera\.tv\//i.test(href) ||
      /tarahipro\.ir\//i.test(href)

    if (!isMedia) continue
    if (seen.has(href)) continue
    seen.add(href)

    const ctxStart = Math.max(0, m.index - 400)
    const ctx = html.slice(ctxStart, m.index + 200)
    const season =
      num(match1(href, /[?&]season=(\d+)/i)) ||
      num(match1(ctx, /فصل\s*(\d+)/)) ||
      num(match1(href, /[._-]S(\d{1,2})[._-]?E\d/i))
    const episode =
      num(match1(href, /[?&]episode=(\d+)/i)) ||
      num(match1(text, /قسمت\s*(\d+)/)) ||
      num(match1(href, /[._-]S\d{1,2}[._-]?E(\d{1,3})/i))

    const quality =
      extractQuality(href) ||
      extractQuality(text) ||
      extractQuality(ctx) ||
      match1(text + ' ' + ctx, /\b(2160p|1080p|720p|480p|360p|4K)\b/i)

    const q = quality || 'HD'
    const badge = qualityBadge(q)
    const host = hostLabel(href)
    const labelParts = []
    if (season != null && episode != null) labelParts.push(`S${season}E${episode}`)
    else if (episode != null) labelParts.push(`E${episode}`)
    labelParts.push(q)
    if (host) labelParts.push(host)

    streams.push({
      url: href,
      quality: q,
      badge: `ZF ${badge}`,
      name: `ZF ${badge}`,
      title: labelParts.join(' · '),
      label: labelParts.join(' · '),
      season: season ?? undefined,
      episode: episode ?? undefined,
      priority: streamPriority(href),
    })
  }

  streams.sort((a, b) => a.priority - b.priority || String(a.quality).localeCompare(String(b.quality)))
  return streams
}

export function groupEpisodeStreams(streams) {
  const map = new Map()
  for (const s of streams || []) {
    if (s.episode == null) continue
    const season = Number(s.season || 1)
    const episode = Number(s.episode)
    const k = `${season}:${episode}`
    if (!map.has(k)) map.set(k, { season, episode, streams: [] })
    map.get(k).streams.push(s)
  }
  return [...map.values()]
}

export function buildSeriesVideos(episodes) {
  return (episodes || [])
    .map((ep) => ({
      season: Number(ep.season),
      episode: Number(ep.episode),
      title: `قسمت ${ep.episode}`,
      streams: ep.streams || [],
    }))
    .sort((a, b) => a.season - b.season || a.episode - b.episode)
}

function streamPriority(url) {
  const u = url.toLowerCase()
  if (/\.(mkv|mp4)(\?|$)/i.test(u) && !/gapfilm/i.test(u)) return 0
  if (/upera\.tv|tarahipro/i.test(u)) return 1
  if (/gapfilm\.ir\/stream/i.test(u)) return 3
  if (/gapfilm\.ir\/download/i.test(u)) return 4
  return 2
}

function hostLabel(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '')
    if (h.includes('tarahipro')) return 'Direct'
    if (h.includes('upera')) return 'Upera'
    if (h.includes('gapfilm')) return 'Gap'
    return h.split('.')[0]
  } catch {
    return ''
  }
}
