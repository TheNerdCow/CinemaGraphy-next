/**
 * DigiMovie HTML parsers — digimoviez*.top WordPress theme.
 * Listing: main archive cards only. Reject sidebar episode tiles + dubbed promo rail.
 * Streams: size unit-first (GB 1.34 / MB 450) + propagate size/encoder to all eps in quality group.
 */

const LRE = '\u202A'
const PDF = '\u202C'
function ltr(text) {
  return `${LRE}${text}${PDF}`
}

const SECTION_ROOTS = new Set([
  'movies', 'series', 'serie', 'category', 'genre', 'tag', 'account',
  'dashboard', 'login', 'page', 'wp-admin', 'wp-content', 'wp-json',
  'top-250', 'top250', '250movie', '250series', 'search', 'contact',
  'contact-us', 'dmca', 'policy', 'privacy', 'terms', 'about', 'faq',
  'help', 'app', 'application', 'artists', 'artist', 'cast', 'casts',
  'actor', 'actors', 'news', 'blog', 'wishlist', 'favorites', 'boxoffice',
  'box-office', 'notifications', 'notification', 'announce', 'announcement',
  'trailer', 'trailers',
])

const NOISE_TITLE_RE =
  /^(ورود|خروج|ثبت\s*نام|تماس(\s*با\s*ما)?|قوانین|DMCA(\s*POLICY)?|POLICY|CONTACT|Home|خانه|جستجو|Search|Login|Logout|APP|اپلیکیشن|هنرمندان|بازیگران|ARTISTS|Cast|لیست\s*علاقه(\s*مندی)?|باکس\s*آفیس|Box\s*Office|اخبار(\s*سینما)?(\s*و\s*هنرمندان)?|فیلم\s*برتر(\s*تاریخ)?\s*[۲۵2]50|سریال\s*برتر(\s*تاریخ)?\s*[۲۵2]50|Top\s*250|اعلان(ات)?|Notifications?|جدیدترین|محبوب‌?ترین|سریال‌?های\s*جدید)$/i

const NOISE_TITLE_IN =
  /DMCA|CONTACT\s*US|تماس\s*با\s*ما|حریم\s*خصوصی|شرایط\s*استفاده|Privacy\s*Policy|Terms\s*of|برتر\s*تاریخ\s*[۲۵2]50|لیست\s*علاقه|اخبار\s*سینما|ARTISTS|هنرمندان|بازیگران|\bCast\b|Top\s*250|باکس\s*آفیس|Box\s*Office|اعلان|Notification|منتشر\s*شد/i

const EPISODE_TITLE_RE =
  /^(قسمت\s*[\d\u06f0-\u06f9]+(\s*فصل\s*[\d\u06f0-\u06f9\w]+)?|فصل\s*[\d\u06f0-\u06f9]+(\s*قسمت\s*[\d\u06f0-\u06f9]+)?)/i

const EPISODE_UPDATE_CARD_RE =
  /قسمت\s*[\d\u06f0-\u06f9]+[\s\S]{0,40}?(فصل|زیرنویس|منتشر)|فصل\s*[\d\u06f0-\u06f9]+[\s\S]{0,40}?(قسمت|زیرنویس|منتشر)|منتشر\s*شد/i

const NOISE_PATH_RE =
  /\b(contact|dmca|policy|privacy|terms|about|faq|login|register|account|dashboard|artists?|cast|casts|actors?|app|application|top-?250|250movie|250series|news|blog|wishlist|favorites?|box-?office|notifications?|announce|trailer)/i

function listingScope(html) {
  let h = String(html || '')
  h = h.replace(/فیلم[‌\s]*های\s*دوبله[\s\S]{0,30000}?(?=<main|class=["'][^"']*archive|<\/body>)/gi, ' ')
  h = h.replace(/دوبله\s*فارسی[\s\S]{0,25000}?(?=<main|class=["'][^"']*archive|<\/body>)/gi, ' ')
  h = h.replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
  h = h.replace(/<(?:div|section)[^>]+class=["'][^"']*(?:sidebar|widget|side-bar|off-canvas|secondary|side_bar|side-panel|sticky-side|home-side|latest-side)[^"']*["'][\s\S]*?<\/(?:div|section)>/gi, ' ')
  h = h.replace(/id=["'](?:sidebar|secondary|widgets?|side)["'][\s\S]{0,120000}/gi, ' ')
  h = h.replace(/سریال[‌\s]*های\s*(جدید|محبوب)[\s\S]{0,30000}?(?=<main|class=["'][^"']*archive|<\/body>)/gi, ' ')
  h = h.replace(/فیلم[‌\s]*های\s*(جدید|محبوب)[\s\S]{0,20000}?(?=<main|class=["'][^"']*archive|<\/body>)/gi, ' ')
  h = h.replace(/تریلی?ر[\s\S]{0,15000}?(?=<main|class=["'][^"']*archive|<\/body>)/gi, ' ')

  const main =
    h.match(/<main[\s\S]*?<\/main>/i) ||
    h.match(/class=["'][^"']*(?:archive|content-area|site-main|movies_list|post-listing|posts-container|main-content|primary)[^"']*["'][\s\S]{0,400000}/i)
  if (main) return main[0]
  return h
}

function extractCards(scope) {
  const cards = []
  const re =
    /<(?:article|div)[^>]+class=["'][^"']*(?:item-movie|movie-item|post-\d|type-post|type-movie|item\s|movie_item|film-item|series-item)[^"']*["'][^>]*>[\s\S]{80,6000}?<\/(?:article|div)>/gi
  let m
  while ((m = re.exec(scope)) !== null) {
    cards.push(m[0])
    if (cards.length >= 24) break
  }
  if (cards.length < 4) {
    const aRe = /<article[\s\S]{80,6000}?<\/article>/gi
    while ((m = aRe.exec(scope)) !== null) {
      cards.push(m[0])
      if (cards.length >= 24) break
    }
  }
  return cards
}

function isEpisodeUpdateCard(cardHtml) {
  const plain = stripTags(cardHtml)
  if (EPISODE_UPDATE_CARD_RE.test(plain)) {
    if (/منتشر\s*شد/i.test(plain) && /قسمت|فصل/i.test(plain)) return true
    if (/قسمت\s*[\d\u06f0-\u06f9]+.*فصل/i.test(plain) && plain.length < 180) return true
  }
  return false
}

function cardToItem(card, base, forceType, seen) {
  if (isEpisodeUpdateCard(card)) return null

  const links = []
  const aRe = /<a[^>]+href=["'](https?:\/\/[^"']+|\/[^"']+)["'][^>]*(?:title=["']([^"']*)["'])?[^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = aRe.exec(card)) !== null) {
    links.push({ href: m[1], titleAttr: m[2] || '', inner: m[3] || '', index: m.index })
  }
  if (!links.length) return null

  let chosen = null
  for (const L of links) {
    const abs = resolveUrl(base, L.href)
    if (!abs || !sameHostFamily(abs, base)) continue
    let pagePath = pathFromUrl(abs)
    if (!pagePath || isNoisePath(pagePath)) continue
    pagePath = normalizeDetailPath(pagePath)
    if (!pagePath || seen.has(pagePath) || isNoisePath(pagePath)) continue
    if (!isLikelyDetailPath(pagePath, forceType)) continue
    chosen = { ...L, abs, pagePath }
    break
  }
  if (!chosen) return null

  let title =
    cleanTitle(chosen.titleAttr) ||
    cleanTitle(stripTags(chosen.inner)) ||
    ''
  if (!title || isNoiseTitle(title) || isEpisodeTitle(title)) {
    const fromPath = titleFromPath(chosen.pagePath)
    if (fromPath && !isNoiseTitle(fromPath) && !isEpisodeTitle(fromPath)) title = fromPath
  }
  if (!title || title.length < 2 || isNoiseTitle(title) || isEpisodeTitle(title)) return null

  if (forceType === 'series' && !/^serie\//i.test(chosen.pagePath)) return null
  if (forceType === 'movie' && /^serie\//i.test(chosen.pagePath)) return null

  let poster =
    match1(card, /(?:data-src|src)=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/i) ||
    match1(card, /background-image:\s*url\(([^)]+)\)/i)
  if (poster) {
    poster = poster.replace(/^['"]|['"]$/g, '').trim()
    poster = resolveUrl(base, poster) || poster
    if (/svg|icon|logo|sprite|avatar|placeholder/i.test(poster)) poster = undefined
  }

  const type = forceType || (/^serie\//i.test(chosen.pagePath) ? 'series' : 'movie')
  seen.add(chosen.pagePath)
  return {
    itemId: encodePageId(chosen.pagePath),
    title,
    year: extractYear(title) || extractYear(chosen.pagePath),
    type,
    poster: poster || undefined,
    pagePath: chosen.pagePath,
  }
}

export function parseListingHtml(html, baseUrl, forceType) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const scope = listingScope(html)
  const seen = new Set()
  const results = []

  const cards = extractCards(scope)
  for (const card of cards) {
    const item = cardToItem(card, base, forceType, seen)
    if (item) {
      results.push(item)
      if (results.length >= 12) break
    }
  }

  if (results.length < 4) {
    const linkRe =
      /<a[^>]+href=["'](https?:\/\/[^"']+|\/[^"']+)["'][^>]*(?:title=["']([^"']*)["'])?[^>]*>([\s\S]*?)<\/a>/gi
    let m
    while ((m = linkRe.exec(scope)) !== null) {
      const abs = resolveUrl(base, m[1])
      if (!abs || !sameHostFamily(abs, base)) continue
      let pagePath = pathFromUrl(abs)
      if (!pagePath || isNoisePath(pagePath)) continue
      pagePath = normalizeDetailPath(pagePath)
      if (!pagePath || seen.has(pagePath) || isNoisePath(pagePath)) continue
      if (!isLikelyDetailPath(pagePath, forceType)) continue

      const start = Math.max(0, m.index - 400)
      const slice = scope.slice(start, m.index + m[0].length + 250)
      if (isEpisodeUpdateCard(slice)) continue

      let title = cleanTitle(m[2] || '') || cleanTitle(stripTags(m[3] || '')) || ''
      if (!title || isNoiseTitle(title) || isEpisodeTitle(title)) {
        const fromPath = titleFromPath(pagePath)
        if (fromPath && !isNoiseTitle(fromPath) && !isEpisodeTitle(fromPath)) title = fromPath
      }
      if (!title || title.length < 2 || isNoiseTitle(title) || isEpisodeTitle(title)) continue
      if (forceType === 'series' && !/^serie\//i.test(pagePath)) continue
      if (forceType === 'movie' && /^serie\//i.test(pagePath)) continue

      let poster =
        match1(slice, /(?:data-src|src)=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/i) ||
        match1(slice, /background-image:\s*url\(([^)]+)\)/i)
      if (poster) {
        poster = poster.replace(/^['"]|['"]$/g, '').trim()
        poster = resolveUrl(base, poster) || poster
        if (/svg|icon|logo|sprite|avatar|placeholder/i.test(poster)) poster = undefined
      }

      const type = forceType || (/^serie\//i.test(pagePath) ? 'series' : 'movie')
      seen.add(pagePath)
      results.push({
        itemId: encodePageId(pagePath),
        title,
        year: extractYear(title) || extractYear(pagePath),
        type,
        poster: poster || undefined,
        pagePath,
      })
      if (results.length >= 12) break
    }
  }

  return results
}

export function parseSearchHtml(html, baseUrl) {
  return parseListingHtml(html, baseUrl, null)
}

export function parseDetailMeta(html, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const title =
    match1(html, /property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
    match1(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const clean = title ? cleanTitle(stripTags(title)) : undefined
  const year = clean ? extractYear(clean) : extractYear(html.slice(0, 12000))
  const imdb = match1(html, /imdb\.com\/title\/(tt\d+)/i)
  let poster =
    match1(html, /property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
    match1(html, /"thumbnailUrl"\s*:\s*"(https?:[^"\\]+)"/i)
  if (poster) poster = resolveUrl(base, poster) || poster
  const ogUrl = match1(html, /property=["']og:url["'][^>]*content=["']([^"']+)["']/i) || ''
  const type =
    /\/serie\//i.test(ogUrl) || /TVSeries|series/i.test(html.slice(0, 8000))
      ? 'series'
      : 'movie'
  return {
    title: clean,
    year: year || undefined,
    imdb: imdb || undefined,
    type,
    poster: poster || undefined,
  }
}

export function parseDetailStreams(html, baseUrl) {
  const out = []
  const seen = new Set()

  const sections = []
  const headerRe =
    /(2160p|1080p|720p|480p|360p)[^\n<]{0,160}?(WEB-?DL|WEBRip|BluRay|HDRip|BRRip)?[^\n<]{0,100}?(SoftSub|HardSub|دوبله|Dubbed)?/gi
  let hm
  while ((hm = headerRe.exec(html)) !== null) {
    const window = html.slice(Math.max(0, hm.index - 100), hm.index + 800)
    const plain = stripTags(window)
    sections.push({
      index: hm.index,
      quality: hm[1] ? hm[1].toLowerCase().replace(/p$/i, '') + 'p' : null,
      source: hm[2] ? String(hm[2]).replace(/WEBDL/i, 'WEB-DL') : null,
      audio: /دوبله|Dubbed/i.test(plain)
        ? 'dub'
        : /SoftSub|HardSub|زیرنویس/i.test(plain)
          ? 'sub'
          : null,
      size: extractSize(plain),
      encoder:
        match1(plain, /Encoder\s*[:=]\s*([A-Za-z0-9._-]+)/i) ||
        match1(plain, /(DigiMoviez?)/i) ||
        null,
      season: (() => {
        const sn = match1(plain, /فصل\s*([\d\u06f0-\u06f9]+)/)
        return sn ? Number(toAsciiDigits(sn)) : null
      })(),
    })
  }
  sections.sort((a, b) => a.index - b.index)

  function sectionAt(pos) {
    let best = null
    for (const s of sections) {
      if (s.index <= pos) best = s
      else break
    }
    return best
  }

  const aRe = /<a[^>]+href=["']([^"']+)["'][^>]*(?:>([\s\S]*?)<\/a>|(?:\s*\/>))/gi
  let am
  while ((am = aRe.exec(html)) !== null) {
    const href = decodeHtml(am[1])
    if (!isPlayableUrl(href)) continue
    if (seen.has(href)) continue
    seen.add(href)

    const start = Math.max(0, am.index - 1200)
    const local = html.slice(start, am.index + am[0].length + 200)
    const localText = stripTags(local) + ' ' + href
    const info = analyze(href, localText)
    const sec = sectionAt(am.index)

    if (sec?.size) info.size = sec.size
    else if (!info.size) info.size = extractSize(localText)
    if (!info.quality && sec?.quality) info.quality = sec.quality
    if (!info.source && sec?.source) info.source = sec.source
    if (!info.audio && sec?.audio) info.audio = sec.audio
    if (sec?.encoder) info.encoder = sec.encoder
    else if (!info.encoder) {
      info.encoder =
        match1(localText, /Encoder\s*[:=]\s*([A-Za-z0-9._-]+)/i) ||
        match1(localText, /(DigiMoviez?)/i) ||
        info.encoder
    }

    const se = href.match(/[Ss]0?(\d+)[Ee]0?(\d+)/)
    if (se) {
      info.season = Number(se[1])
      info.episode = Number(se[2])
    } else {
      const epFa = match1(localText, /قسمت\s*([\d\u06f0-\u06f9]+)/)
      if (epFa) info.episode = Number(toAsciiDigits(epFa))
      const snFa = match1(localText, /فصل\s*([\d\u06f0-\u06f9]+)/)
      if (snFa) info.season = Number(toAsciiDigits(snFa))
      else if (sec?.season != null) info.season = sec.season
    }

    out.push({
      url: href,
      ...info,
      badge: qualityBadge(info.quality),
    })
  }

  propagateGroupMeta(out)

  for (const s of out) {
    s.label = formatLabel(s)
  }

  const rank = (s) => {
    const q = parseInt(String(s.quality || '').replace(/\D/g, ''), 10) || 0
    return q + (s.hdr ? 40 : 0) + (s.audio === 'dub' ? 8 : 0)
  }
  out.sort((a, b) => rank(b) - rank(a))
  return out
}

/** Same quality+source+audio(+season) → share size & encoder across all streams. */
function propagateGroupMeta(streams) {
  const groups = new Map()
  for (const s of streams) {
    const key = [
      String(s.quality || '').toLowerCase(),
      String(s.source || '').toLowerCase(),
      String(s.audio || ''),
      s.season != null ? String(s.season) : '',
      String(s.codec || ''),
    ].join('|')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(s)
  }
  for (const list of groups.values()) {
    const size = list.find((x) => x.size)?.size
    const encoder = list.find((x) => x.encoder)?.encoder
    const source = list.find((x) => x.source)?.source
    const quality = list.find((x) => x.quality)?.quality
    for (const s of list) {
      if (!s.size && size) s.size = size
      if (!s.encoder && encoder) s.encoder = encoder
      if (!s.source && source) s.source = source
      if (!s.quality && quality) s.quality = quality
    }
  }
}

export function buildSeriesVideos(streams) {
  const map = new Map()
  for (const s of streams || []) {
    if (s.episode == null) continue
    const season = Number(s.season || 1)
    const episode = Number(s.episode)
    const key = `${season}:${episode}`
    if (!map.has(key)) {
      map.set(key, {
        season,
        episode,
        title: `S${season}E${episode}`,
        streams: [],
      })
    }
    map.get(key).streams.push(s)
  }
  return [...map.values()].sort((a, b) => a.season - b.season || a.episode - b.episode)
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

function normalizeDetailPath(pagePath) {
  const segs = String(pagePath)
    .replace(/\/+$/, '')
    .split('/')
    .filter(Boolean)
  if (!segs.length) return null
  if (segs[0].toLowerCase() === 'serie' && segs.length >= 2) {
    return `serie/${segs[1]}`
  }
  if (segs.length === 1) return segs[0]
  return segs.join('/')
}

function titleFromPath(pagePath) {
  const segs = String(pagePath).split('/').filter(Boolean)
  const slug = segs[0] === 'serie' ? segs[1] : segs[segs.length - 1]
  if (!slug) return ''
  try {
    return cleanTitle(decodeURIComponent(slug).replace(/-/g, ' '))
  } catch {
    return cleanTitle(slug.replace(/-/g, ' '))
  }
}

function isEpisodeTitle(title) {
  const t = String(title || '').trim()
  if (!t) return false
  if (EPISODE_TITLE_RE.test(t)) return true
  if (/قسمت/.test(t) && /فصل/.test(t)) return true
  if (/منتشر\s*شد/.test(t) && (/قسمت|فصل/.test(t) || t.length < 50)) return true
  if (/^S\d+E\d+$/i.test(t)) return true
  return false
}

function analyze(url, ctx) {
  const t = String(ctx || '') + ' ' + String(url || '')
  const quality =
    match1(t, /\b(2160p|1080p|720p|480p|360p)\b/i) ||
    match1(url, /\b(2160p|1080p|720p|480p)\b/i)
  const size = extractSize(t) || extractSize(url)
  const audio =
    /دوبله|Farsi\.Dubbed|Dubbed/i.test(t)
      ? 'dub'
      : /SoftSub|HardSub|زیرنویس/i.test(t)
        ? 'sub'
        : null
  const source =
    /BluRay/i.test(t)
      ? 'BluRay'
      : /WEB-?DL/i.test(t)
        ? 'WEB-DL'
        : /WEBRip/i.test(t)
          ? 'WEBRip'
          : null
  const codec = /x265|HEVC/i.test(t) ? 'x265' : /x264|h\.?264/i.test(t) ? 'x264' : null
  const hdr = /\bHDR\b/i.test(t)
  const bit10 = /10\s*bit|10bit/i.test(t)
  const encoder =
    match1(t, /Encoder\s*[:=]\s*([A-Za-z0-9._-]+)/i) ||
    match1(t, /(?:DigiMoviez?|PSA|Pahe|PaHe|FLUX|YTS|RARBG)(?=\.|\s|$|\?)/i) ||
    undefined
  return {
    quality: quality || undefined,
    size: size || undefined,
    audio,
    source,
    codec,
    hdr: Boolean(hdr),
    bit10: Boolean(bit10),
    encoder,
    providerName: 'DigiMovie',
    providerEmoji: '🎬',
  }
}

function formatLabel(info) {
  const lines = []
  const emoji = info.providerEmoji || '🎬'
  const provider = info.providerName || 'DigiMovie'
  lines.push(`${emoji} منبع: ${ltr(provider)}`)

  const tech = []
  if (info.quality) tech.push(String(info.quality))
  if (info.hdr) tech.push('HDR')
  if (info.bit10) tech.push('10bit')
  if (info.source) tech.push(info.source)
  if (info.codec) tech.push(info.codec)
  if (tech.length) lines.push(`📊 کیفیت: ${ltr(tech.join(' · '))}`)

  if (info.audio === 'sub') lines.push('📝 زیرنویس: زیرنویس چسبیده فارسی')
  else if (info.audio === 'dub') lines.push('🎧 دوبله: دوبله فارسی')

  if (info.encoder && !/^unknown$/i.test(info.encoder)) {
    lines.push(`🎞️ انکدر: ${ltr(String(info.encoder))}`)
  }
  if (info.size) lines.push(`📦 سایز: ${ltr(String(info.size))}`)
  if (info.season != null && info.episode != null) {
    lines.push(ltr(`S${info.season}E${info.episode}`))
  }
  return lines.join('\n')
}

function qualityBadge(q) {
  if (!q) return 'HD'
  const n = parseInt(String(q).replace(/\D/g, ''), 10)
  if (n >= 2160) return '4K'
  if (n >= 1080) return '1080p'
  if (n >= 720) return '720p'
  if (n >= 480) return '480p'
  return String(q)
}

function isPlayableUrl(href) {
  try {
    const u = new URL(href)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const s = href.toLowerCase()
    if (/\.(mp4|mkv|m3u8)(\?|$)/i.test(s)) return true
    if (/\/dl\d?\/|cdn\d*\.|digi.*dl/i.test(s)) return true
    return false
  } catch {
    return false
  }
}

function isNoiseTitle(title) {
  const t = String(title || '').trim()
  if (!t || t.length <= 2) return true
  if (NOISE_TITLE_RE.test(t)) return true
  if (NOISE_TITLE_IN.test(t)) return true
  if (/^[-–—>\s\u200c]+$/.test(t)) return true
  if ((t.match(/-/g) || []).length >= 4 && t.length < 40) return true
  if (/^[\d\u06f0-\u06f9]{2,4}$/.test(t)) return true
  return false
}

function isNoisePath(pagePath) {
  const raw = String(pagePath).replace(/\/+$/, '')
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    /* keep */
  }
  const lower = decoded.toLowerCase()
  const segs = lower.split('/').filter(Boolean)
  if (!segs.length) return true
  if (NOISE_PATH_RE.test(lower)) return true
  if (/برتر|علاقه|هنرمند|بازیگر|اخبار|تماس|قوانین|باکس|اعلان|افیس|\bcast\b|تریلی?ر/.test(decoded)) {
    return true
  }
  if (segs.length === 1 && SECTION_ROOTS.has(segs[0])) return true
  if (segs.length >= 2 && SECTION_ROOTS.has(segs[0]) && segs[1] === 'page') return true
  if (segs[0] === 'serie' && segs.length === 1) return true
  if (segs[0] === 'category' || segs[0] === 'genre' || segs[0] === 'tag') return true
  return false
}

function isLikelyDetailPath(pagePath, forceType) {
  const segs = String(pagePath).split('/').filter(Boolean)
  if (!segs.length) return false
  if (segs[0] === 'serie' && segs.length >= 2 && segs[1] !== 'page') return true
  if (forceType === 'series') return false
  if (segs.length === 1 && segs[0].length > 3 && !SECTION_ROOTS.has(segs[0].toLowerCase())) {
    return true
  }
  return false
}

function sameHostFamily(a, b) {
  try {
    const ha = new URL(a).hostname.replace(/^www\./i, '').toLowerCase()
    const hb = new URL(b).hostname.replace(/^www\./i, '').toLowerCase()
    if (ha === hb) return true
    const digi = (h) => /digimoviez/i.test(h)
    if (digi(ha) && digi(hb)) return true
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

function pathFromUrl(abs) {
  try {
    const u = new URL(abs)
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
  return stripTags(t)
    .replace(/^Download\s+/i, '')
    .replace(/\bDownload\b/gi, ' ')
    .replace(/دانلود\s*(فیلم|سریال|انیمیشن|انیمه)?/gi, '')
    .replace(/بدون\s*سانسور.*$/gi, '')
    .replace(/با\s*زیرنویس.*$/gi, '')
    .replace(/منتشر\s*شد.*$/gi, '')
    .replace(/قسمت\s*[\d\u06f0-\u06f9]+.*$/gi, '')
    .replace(/فصل\s*[\d\u06f0-\u06f9]+.*$/gi, '')
    .replace(/-\s*دیجی\s*موویز?.*$/gi, '')
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

function decodeHtml(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function toAsciiDigits(s) {
  return String(s || '').replace(/[\u06f0-\u06f9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
}

/** Digi shows both "1.34 GB" and "GB 1.34" / "MB 450". */
function extractSize(text) {
  const s = String(text || '')
  let m = s.match(/(?:^|[^\d.])(\d+(?:[.,]\d+)?)\s*(GB|MB|گیگابایت|مگابایت|گیگ|مگ)(?![\w\u0600-\u06ff])/i)
  if (m) return normalizeSize(m[1].replace(',', '.') + ' ' + m[2])
  m = s.match(/(?:^|[^\w])(GB|MB|گیگابایت|مگابایت|گیگ|مگ)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?![\d.])/i)
  if (m) return normalizeSize(m[2].replace(',', '.') + ' ' + m[1])
  return null
}

function normalizeSize(s) {
  if (!s) return null
  return String(s)
    .replace(/گیگابایت/i, 'GB')
    .replace(/مگابایت/i, 'MB')
    .replace(/گیگ/i, 'GB')
    .replace(/مگ/i, 'MB')
    .replace(/\s+/g, ' ')
    .trim()
}

function match1(s, re) {
  const m = String(s).match(re)
  return m ? m[1] : null
}
