/**
 * ZardFilm HTML parsers — listing cards, detail meta, download streams.
 * Prefer direct media hosts; skip online-play; label like other providers.
 * Catalog lists come from .zaf-grid / #zaf-server only (newest updates), not trend rails.
 * Iranian movie/series titles are filtered out of listings.
 * WP REST search JSON supported for streams-only resolve.
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
    .replace(/\s*بدون\s*سانسور\s*/gi, ' ')
    .replace(/\s*با\s*لینک\s*مستقیم\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (/[A-Za-z]{3,}/.test(t) && /[\u0600-\u06FF]/.test(t)) {
    const cut = t.replace(/[\u0600-\u06FF\u064B-\u065F].*$/u, '').trim()
    if (cut.length >= 4) t = cut
  }
  t = t.replace(/\s+(?:19|20)\d{2}\s*$/, '').trim()
  return t
}

function tryDecode(s) {
  try {
    return decodeURIComponent(String(s || ''))
  } catch {
    return String(s || '')
  }
}

function isLikelyIranian(title, pagePath, block) {
  const t = String(title || '').trim()
  const path = tryDecode(String(pagePath || '')).toLowerCase()
  const slug = path.split('/').pop() || ''
  const blob = tryDecode(String(block || ''))

  if (/[A-Za-z]{3,}/.test(t) && /\b(19|20)\d{2}\b/.test(t) && !/[\u0600-\u06FF]{3,}/.test(t)) return false
  if (/%d[89a-f]{2}/i.test(pagePath || '')) return true
  if (/[\u0600-\u06FF]{2,}/.test(path) && !/[A-Za-z]{3,}/.test(path)) return true

  const hasPersian = /[\u0600-\u06FF]{2,}/.test(t)
  const hasLatin = /[A-Za-z]{3,}/.test(t)
  if (hasPersian && !hasLatin) return true
  if (/\b14[0-9]{2}\b/.test(blob) && (!hasLatin || hasPersian)) return true

  if (/\b(nim-?rokh|shah-?gol|kouri|kori|eteraf|mikonam|ostekhan|sooz|safineh|nejat|bi-?dar|cafe-?soltan|escort|yil|yal|dijam|bist-?o-?yek|21-series|pardes|aghagh)\b/i.test(slug + ' ' + t)) {
    if (/uyanis-buyuk|selcuklu|genghis|napoleon/i.test(slug + t)) return false
    if (hasLatin && /\b(19|20)\d{2}\b/.test(t) && !hasPersian) return false
    return true
  }

  if (/^[a-z0-9]+(?:-[a-z0-9]+){1,12}$/i.test(t) && !/\b(the|of|and|movie|series|season|episode)\b/i.test(t)) return true

  return false
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

function gapQuality(n) {
  const map = { 5: '1080p', 4: '720p', 3: '480p', 2: '360p', 6: '2160p' }
  return map[String(n)] || null
}

function extractArchiveGrid(html) {
  const s = String(html || '')
  let idx = s.search(/id=["']zaf-server["']/i)
  if (idx < 0) idx = s.search(/class=["'][^"']*\bzaf-list\b[^"']*["']/i)
  if (idx < 0) idx = s.search(/class=["'][^"']*\bzaf-grid\b[^"']*["']/i)
  if (idx >= 0) {
    const tail = s.slice(idx)
    const endM = tail.search(/class=["'][^"']*(?:pagination|nav-links|zard-footer|site-footer)[^"']*["']|rel=["']next["']/i)
    const chunk = endM > 0 ? tail.slice(0, endM) : tail.slice(0, 120000)
    if (/<article[^>]*class="[^"]*\bzc\b/i.test(chunk)) return chunk
  }
  return s
    .replace(/<ol[^>]*class="[^"]*zn-rank[^"]*"[^>]*>[\s\S]*?<\/ol>/gi, '')
    .replace(/<ol[^>]*class="[^"]*zn-rail[^"]*"[^>]*>[\s\S]*?<\/ol>/gi, '')
    .replace(/<div[^>]*class="[^"]*zaf-rails[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*class="[^"]*zrl-track[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
}

export function parseListingHtml(html, baseUrl, forceType = null) {
  const base = String(baseUrl || 'https://zardfilm.in').replace(/\/+$/, '')
  const results = []
  const seen = new Set()
  let scope = extractArchiveGrid(html)

  const articleRe = /<article[^>]*class="[^"]*\bzc\b[^"]*"[^>]*>([\s\S]*?)<\/article>/gi
  let m
  while ((m = articleRe.exec(scope)) !== null) {
    const block = m[0]
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
    const decodedPath = tryDecode(pagePath).replace(/^\/+/, '').replace(/\/+$/, '')
    const finalTitle = cleanTitle(tryDecode(title))
    if (isLikelyIranian(finalTitle, pagePath, block)) continue
    if (!poster && /^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(finalTitle)) continue

    seen.add(pagePath)
    seen.add(decodedPath)
    results.push({
      itemId: encodePageId(decodedPath.startsWith('movie/') ? decodedPath : pagePath),
      pagePath: decodedPath.startsWith('movie/') ? decodedPath : pagePath,
      type,
      title: finalTitle,
      year,
      poster,
      imdb: null,
    })
  }

  if (!results.length) {
    const linkRe = /href=["']((?:https?:\/\/[^"']+)?\/movie\/[^"'#?]+)["'][^>]*>/gi
    while ((m = linkRe.exec(scope)) !== null) {
      const abs = resolveUrl(base, m[1])
      if (!abs) continue
      let pagePath
      try {
        pagePath = new URL(abs).pathname.replace(/^\/+/, '').replace(/\/+$/, '')
      } catch {
        continue
      }
      if (!pagePath.startsWith('movie/') || seen.has(pagePath)) continue
      const ctx = scope.slice(Math.max(0, m.index - 80), m.index + 400)
      const en = ctx.match(/class="zc-en"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/i)
      const title = en ? en[1].trim() : cleanTitle(match1(ctx, /alt=["']([^"']+)["']/i) || pagePath.split('/').pop())
      if (!title || title.length < 2) continue
      const finalTitle = cleanTitle(tryDecode(title))
      if (isLikelyIranian(finalTitle, pagePath, ctx)) continue
      const decodedPath = tryDecode(pagePath).replace(/^\/+/, '').replace(/\/+$/, '')
      const img = absPoster(base, match1(ctx, /src=["']([^"']+\.(?:webp|jpg|jpeg|png)[^"']*)["']/i))
      if (!img && /^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(finalTitle)) continue
      seen.add(pagePath)
      seen.add(decodedPath)
      results.push({
        itemId: encodePageId(decodedPath.startsWith('movie/') ? decodedPath : pagePath),
        pagePath: decodedPath.startsWith('movie/') ? decodedPath : pagePath,
        type: forceType || (/series|سریال/i.test(pagePath + ctx) ? 'series' : 'movie'),
        title: finalTitle,
        year: extractYear(ctx),
        poster: img,
        imdb: null,
      })
    }
  }

  return results
}

export function parseSearchHtml(html, baseUrl) {
  return parseListingHtml(html, baseUrl, null)
}

/** WP REST /wp-json/wp/v2/search or posts — used in streams-only resolve. */
export function parseWpSearchJson(rows, baseUrl = 'https://zardfilm.in') {
  const base = String(baseUrl || 'https://zardfilm.in').replace(/\/+$/, '')
  const results = []
  const seen = new Set()
  for (const row of rows || []) {
    const url = String(row?.url || row?.link || '')
    if (!url || !/\/movie\//i.test(url)) continue
    let pagePath
    try {
      pagePath = new URL(url, base).pathname.replace(/^\/+/, '').replace(/\/+$/, '')
    } catch {
      continue
    }
    if (!pagePath.startsWith('movie/') || seen.has(pagePath)) continue
    const rawTitle =
      typeof row?.title === 'object' && row?.title != null
        ? String(row.title.rendered || row.title.raw || '')
        : String(row?.title || row?.name || '')
    const title = cleanTitle(tryDecode(rawTitle))
    if (!title || title.length < 2) continue
    if (isLikelyIranian(title, pagePath, rawTitle)) continue
    const isSeries =
      /سریال|series|season|anime|انیمه/i.test(rawTitle + ' ' + pagePath) ||
      /-series\b/i.test(pagePath)
    seen.add(pagePath)
    results.push({
      itemId: encodePageId(pagePath),
      pagePath,
      type: isSeries ? 'series' : 'movie',
      title,
      year: extractYear(rawTitle) || extractYear(title),
      poster: null,
      imdb: null,
    })
  }
  return results
}

export function parseDetailMeta(html, baseUrl, pagePath) {
  const base = String(baseUrl || 'https://zardfilm.in').replace(/\/+$/, '')
  const title =
    cleanTitle(match1(html, /property=["']og:title["'][^>]*content=["']([^"']+)["']/i)) ||
    cleanTitle(match1(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)) ||
    cleanTitle(tryDecode(pagePath.split('/').pop()).replace(/-/g, ' '))

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
    title: cleanTitle(tryDecode(title)),
    year,
    poster,
    imdb: imdb || null,
    type: isSeries ? 'series' : 'movie',
  }
}

export function parseDetailStreams(html) {
  const streams = []
  const seen = new Set()

  const anchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = anchorRe.exec(html)) !== null) {
    let href = decodeEntities(m[1]).trim()
    if (!href || href.startsWith('#')) continue
    const text = stripTags(m[2])
    const ctx = html.slice(Math.max(0, m.index - 220), m.index + 280)

    if (/پخش\s*آنلاین/i.test(text) || /gapfilm\.ir\/stream\//i.test(href)) continue
    if (/upera\.tv/i.test(href) && !/\.(mp4|mkv)(\?|$)/i.test(href)) continue

    const isMedia =
      /\.(mkv|mp4)(\?|$)/i.test(href) ||
      /gapfilm\.ir\/download\//i.test(href) ||
      /tarahipro\.ir/i.test(href) ||
      /upera\.tv\/[^\s"']+\.(mp4|mkv)/i.test(href)

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

    let quality =
      extractQuality(text) ||
      extractQuality(href) ||
      extractQuality(ctx) ||
      gapQuality(match1(href, /[?&]quality=(\d+)/i)) ||
      match1(href, /[_.-](2160|1080|720|480|360)(?:p)?[_.-]/i) ||
      match1(href, /-(?:HQ_)?(2160|1080|720|480|360)(?:\.mp4|\.mkv)/i)

    if (quality && !/p$/i.test(quality) && /^\d+$/.test(quality)) {
      quality = quality + 'p'
    }

    const info = analyzeMediaUrl(href)
    if (!info.quality && quality) info.quality = quality
    if (!info.quality) info.quality = quality || 'HD'

    if (/SoftSub|HardSub|Hard\.Sub|\bSUB\b/i.test(href)) {
      info.audio = 'sub'
    } else if (/\bDubbed\b|\b4Dub\b|Farsi\.Dub/i.test(href)) {
      info.audio = 'dub'
    } else {
      const above = html.slice(Math.max(0, m.index - 2500), m.index)
      let last = null
      const reHead = /زیرنویس\s*(?:فارسی\s*)?چسبیده|زیرنویس\s*فارسی|دوبله(?:ٔ|\s)?فارسی|دوبله/gi
      let hm
      while ((hm = reHead.exec(above)) !== null) {
        const h = hm[0]
        last = /دوبله/i.test(h) && !/زیرنویس/i.test(h) ? 'dub' : 'sub'
      }
      if (!last && /upera\.tv\/\d+-11-/i.test(href)) last = 'sub'
      if (!last && /upera\.tv\/\d+-0-/i.test(href) && /دوبله/i.test(text + above.slice(-400))) last = 'dub'
      if (last) info.audio = last
      else if (/زیرنویس/i.test(text)) info.audio = 'sub'
      else if (/دوبله/i.test(text)) info.audio = 'dub'
    }

    if (!info.encoder) {
      info.encoder = extractEncoderFromText(href) || extractEncoderFromText(text) || 'ZardFilm'
    }
    if (!info.size) info.size = extractSizeFromText(text + ' ' + ctx)
    if (!info.source && (/\.ZF\.|\/ZF\./i.test(href) || /upera\.tv/i.test(href))) info.source = 'WEB-DL'

    info.providerEmoji = '🎬'
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

  streams.sort((a, b) => {
    const qa = qualityRank(a.quality)
    const qb = qualityRank(b.quality)
    if (qb !== qa) return qb - qa
    if (a.priority !== b.priority) return a.priority - b.priority
    return (a.episode || 0) - (b.episode || 0)
  })
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

function qualityRank(q) {
  const s = String(q || '')
  if (/2160|4K/i.test(s)) return 4000
  if (/1080/i.test(s)) return 1080
  if (/720/i.test(s)) return 720
  if (/480/i.test(s)) return 480
  if (/360/i.test(s)) return 360
  const n = parseInt(s.replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

function streamPriority(url) {
  const u = url.toLowerCase()
  if (/\.(mkv|mp4)(\?|$)/i.test(u) && !/gapfilm/i.test(u) && !/upera/i.test(u)) return 0
  if (/upera\.tv/i.test(u) && /\.(mkv|mp4)/i.test(u)) return 1
  if (/tarahipro/i.test(u)) return 1
  if (/gapfilm\.ir\/download/i.test(u)) return 2
  return 5
}
