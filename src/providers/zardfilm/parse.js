/**
 * ZardFilm HTML parsers — listing cards, detail meta, download streams.
 * Prefer direct media hosts; skip online-play; label like other providers.
 */

import {
  qualityBadge,
  formatStreamLabel,
  analyzeMediaUrl,
  extractQuality,
  extractEncoderFromText,
  extractSizeFromText,
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
    .replace(/&/g, '&')
    .replace(/"/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/</g, '<')
    .replace(/>/g, '>')
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

/** gapfilm quality=N → resolution (site buttons: 5=1080, 4=720, 3=480) */
function gapQuality(n) {
  const map = { 5: '1080p', 4: '720p', 3: '480p', 2: '360p', 6: '2160p' }
  return map[String(n)] || null
}

/**
 * Listing: only /movie/{slug}/ cards from the main grid (article.zc).
 * Prefer English title (zc-en) + year; series via zc--series / kind tag.
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
    // only real title pages under /movie/ — skip /news/ and other sections
    const hrefM = block.match(/href=["']((?:https?:\/\/[^"']+)?\/movie\/[^"'#?]+)["']/i)
    if (!hrefM) continue
    const abs = resolveUrl(base, hrefM[1])
    if (!abs || !/\/movie\//i.test(abs)) continue
    let pagePath
    try {
      pagePath = new URL(abs).pathname.replace(/^\/+/, '').replace(/\/+$/, '')
    } catch {
      continue
    }
    if (!pagePath.startsWith('movie/')) continue
    if (seen.has(pagePath)) continue

    // English title preferred (zc-en span + year)
    const en = block.match(/class="zc-en"[^>]*>[\s\S]*?<span>([^<]+)<\/span>[\s\S]*?<b>(\d{4})<\/b>/i)
    const fa = block.match(/class="zc-fa"[^>]*>([^<]+)</i)
    let title = en ? en[1].trim() : null
    if (!title && fa) title = fa[1].trim()
    if (!title) {
      const alt = block.match(/alt=["']([^"']+)["']/i)
      title = alt ? cleanTitle(alt[1]) : null
    }
    if (!title || title.length < 2) continue

    const year = en ? Number(en[2]) : extractYear(block) || extractYear(title)
    const imgM = block.match(/<img[^>]+src=["']([^"']+)["']/i)
    const poster = imgM ? absPoster(base, imgM[1]) : null

    const isSeries =
      /\bzc--series\b/i.test(block) ||
      /class="zc-kind"[^>]*>\s*سریال/i.test(block) ||
      /series|سریال|انیمه/i.test(pagePath)

    const type = forceType || (isSeries ? 'series' : 'movie')

    seen.add(pagePath)
    results.push({
      itemId: encodePageId(pagePath),
      pagePath,
      type,
      title: cleanTitle(title),
      year,
      poster,
      imdb: null,
    })
  }

  // Fallback: any /movie/ anchors if article parse found nothing
  if (!results.length) {
    const linkRe = /href=["']((?:https?:\/\/[^"']+)?\/movie\/[^"'#?]+)["'][^>]*>/gi
    while ((m = linkRe.exec(html)) !== null) {
      const abs = resolveUrl(base, m[1])
      if (!abs) continue
      let pagePath
      try {
        pagePath = new URL(abs).pathname.replace(/^\/+/, '').replace(/\/+$/, '')
      } catch {
        continue
      }
      if (!pagePath.startsWith('movie/') || seen.has(pagePath)) continue
      const ctx = html.slice(Math.max(0, m.index - 80), m.index + 400)
      const en = ctx.match(/class="zc-en"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/i)
      const title = en ? en[1].trim() : cleanTitle(match1(ctx, /alt=["']([^"']+)["']/i) || pagePath.split('/').pop())
      if (!title || title.length < 2) continue
      seen.add(pagePath)
      results.push({
        itemId: encodePageId(pagePath),
        pagePath,
        type: forceType || (/series|سریال/i.test(pagePath + ctx) ? 'series' : 'movie'),
        title: cleanTitle(title),
        year: extractYear(ctx),
        poster: absPoster(base, match1(ctx, /src=["']([^"']+\.(?:webp|jpg|jpeg|png)[^"']*)["']/i)),
        imdb: null,
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
  const title =
    cleanTitle(match1(html, /property=["']og:title["'][^>]*content=["']([^"']+)["']/i)) ||
    cleanTitle(match1(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)) ||
    cleanTitle(pagePath.split('/').pop().replace(/-/g, ' '))

  const year =
    extractYear(match1(html, /property=["']og:title["'][^>]*content=["']([^"']+)["']/i) || '') ||
    extractYear(title) ||
    num(match1(html, /\b(19|20)\d{2}\b/))

  const poster =
    absPoster(base, match1(html, /property=["']og:image["'][^>]*content=["']([^"']+)["']/i)) ||
    absPoster(base, match1(html, /<img[^>]+class="[^"]*poster[^"]*"[^>]+src=["']([^"']+)["']/i))

  const imdb =
    match1(html, /imdb\.com\/title\/(tt\d+)/i) ||
    match1(html, /["'](tt\d{5,})["']/)

  const isSeries =
    /zc--series|نوع[^<]{0,20}سریال|og:type["'][^>]*video\.tv|\/series/i.test(html) ||
    /سریال/i.test(title) ||
    /series/i.test(pagePath)

  return {
    title,
    year,
    poster,
    imdb: imdb || null,
    type: isSeries ? 'series' : 'movie',
  }
}

/**
 * Download links only (skip «پخش آنلاین»).
 * Labels match F2/Asl style via formatStreamLabel.
 */
export function parseDetailStreams(html) {
  const streams = []
  const seen = new Set()
  // page-level audio hint
  const pageAudio = /دوبله(?:ٔ|\s)?فارسی/i.test(html)
    ? 'dub'
    : /زیرنویس(?:\s+چسبیده)?(?:\s+فارسی)?/i.test(html)
      ? 'sub'
      : null

  const anchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = anchorRe.exec(html)) !== null) {
    let href = decodeEntities(m[1]).trim()
    if (!href || href.startsWith('#')) continue
    const text = stripTags(m[2])
    const ctx = html.slice(Math.max(0, m.index - 220), m.index + 280)

    // skip online play / streaming players
    if (/پخش\s*آنلاین/i.test(text) || /gapfilm\.ir\/stream\//i.test(href)) continue
    if (/upera\.tv/i.test(href)) continue

    const isMedia =
      /\.(mkv|mp4)(\?|$)/i.test(href) ||
      /gapfilm\.ir\/download\//i.test(href) ||
      /tarahipro\.ir/i.test(href)

    if (!isMedia) continue

    try {
      href = new URL(href, 'https://zardfilm.in').href
    } catch {
      continue
    }
    if (seen.has(href)) continue
    seen.add(href)

    const se = href.match(/[._-]S(\d{1,2})E(\d{1,3})(?:[._-]|$)/i)
    const season =
      num(match1(href, /[?&]season=(\d+)/i)) ||
      (se ? Number(se[1]) : null) ||
      num(match1(text, /فصل\s*(\d+)/))
    let episode =
      num(match1(href, /[?&]episode=(\d+)/i)) ||
      (se ? Number(se[2]) : null)
    if (episode == null && season != null) {
      episode = num(match1(text, /قسمت\s*(\d+)/))
    }

    // quality: button text > URL filename > gapfilm quality=N > _1080. patterns
    let quality =
      extractQuality(text) ||
      extractQuality(href) ||
      extractQuality(ctx) ||
      gapQuality(match1(href, /[?&]quality=(\d+)/i)) ||
      match1(href, /[_.-](2160|1080|720|480|360)(?:p)?[_.-]/i)

    if (quality && !/p$/i.test(quality) && /^\d+$/.test(quality)) {
      quality = quality + 'p'
    }

    const info = analyzeMediaUrl(href)
    if (!info.quality && quality) info.quality = quality
    if (!info.quality) info.quality = quality || 'HD'
    if (/SoftSub|HardSub|\bSUB\b|زیرنویس/i.test(href + ' ' + text)) {
      info.audio = 'sub'
    } else if (/\bDubbed\b|\b4Dub\b|دوبله/i.test(href + ' ' + text)) {
      info.audio = 'dub'
    } else if (!info.audio && pageAudio) {
      info.audio = pageAudio
    }
    if (!info.encoder) {
      info.encoder = extractEncoderFromText(href) || extractEncoderFromText(text) || 'ZardFilm'
    }
    if (!info.size) info.size = extractSizeFromText(text + ' ' + ctx)
    // default source for ZF encodes
    if (!info.source && /\.ZF\.|\/ZF\./i.test(href)) info.source = 'WEB-DL'

    info.providerEmoji = '🟡'
    info.providerName = 'ZardFilm'

    const label = formatStreamLabel(info)
    const badge = qualityBadge(info.quality)

    streams.push({
      url: href,
      quality: info.quality,
      badge,
      name: badge,
      title: label,
      label,
      season: season ?? undefined,
      episode: episode ?? undefined,
      audio: info.audio,
      source: info.source,
      encoder: info.encoder,
      priority: streamPriority(href),
    })
  }

  streams.sort(
    (a, b) =>
      a.priority - b.priority ||
      String(b.quality).localeCompare(String(a.quality)) ||
      (a.episode || 0) - (b.episode || 0),
  )
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
      title: `فصل ${ep.season} - قسمت ${ep.episode}`,
      streams: ep.streams || [],
    }))
    .sort((a, b) => a.season - b.season || a.episode - b.episode)
}

function streamPriority(url) {
  const u = url.toLowerCase()
  if (/\.(mkv|mp4)(\?|$)/i.test(u) && !/gapfilm/i.test(u)) return 0
  if (/tarahipro/i.test(u)) return 1
  if (/gapfilm\.ir\/download/i.test(u)) return 2
  return 5
}
