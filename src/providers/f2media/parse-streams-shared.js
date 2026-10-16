/** Shared stream labeling helpers (used by movie + series parsers). */

const LRE = '\u202A'
const PDF = '\u202C'
function ltr(text) {
  return `${LRE}${text}${PDF}`
}

export function qualityBadge(quality) {
  const q = String(quality || '')
  if (/2160|4K/i.test(q)) return '4K'
  if (/1080/i.test(q)) return '1080p'
  if (/720/i.test(q)) return '720p'
  if (/480/i.test(q)) return '480p'
  if (/360/i.test(q)) return '360p'
  return q || 'HD'
}

export function formatStreamLabel(info = {}) {
  const lines = []
  const emoji = info.providerEmoji || '🎬'
  const provider = info.providerName || 'F2Media'
  lines.push(`${emoji} منبع: ${ltr(provider)}`)

  const tech = []
  if (info.quality) {
    const q = String(info.quality)
    if (/2160|4K/i.test(q)) tech.push('2160p')
    else tech.push(q)
  }
  if (info.hdr) tech.push('HDR')
  if (info.bit10) tech.push('10bit')
  if (info.source) tech.push(info.source)
  if (info.codec) tech.push(info.codec)
  if (tech.length) lines.push(`📊 کیفیت: ${ltr(tech.join(' · '))}`)

  if (info.audio === 'sub') lines.push('📝 زیرنویس: زیرنویس چسبیده فارسی')
  else if (info.audio === 'dub') lines.push('🎧 دوبله: دوبله فارسی')

  if (info.encoder && !/^unknown$/i.test(info.encoder)) {
    lines.push(`🎞️ انکدر: ${ltr(info.encoder)}`)
  }
  if (info.size) lines.push(`📦 سایز: ${ltr(String(info.size))}`)
  if (info.isAudioOnly) lines.push('🔊 فقط صدا')

  return lines.join('\n')
}

export function analyzeMediaUrl(url) {
  const u = String(url)
  const quality = extractQuality(u)
  let audio = null
  // Path folders used by F2: 4DUB, RSUB, SUB, DUB, FixNamaDUB, …
  if (
    /\/4DUB\/|\/DUB\/|Farsi\.4Dubbed|Farsi\.Dubbed|\bDubbed\b|دوبله/i.test(u)
  ) {
    audio = 'dub'
  } else if (
    /\/RSUB\/|\/SUB\/|Farsi\.Sub|HardSub|hardsub|زیرنویس/i.test(u)
  ) {
    audio = 'sub'
  }

  const source = /BluRay/i.test(u)
    ? 'BluRay'
    : /WEB-?DL/i.test(u)
      ? 'WEB-DL'
      : /WEBRip/i.test(u)
        ? 'WEBRip'
        : /HDTV/i.test(u)
          ? 'HDTV'
          : null
  const codec = /x265|HEVC/i.test(u) ? 'x265' : /x264|AVC/i.test(u) ? 'x264' : null
  const hdr = /\bHDR10|\bHDR\b|\bDV\b|Dolby.?Vision/i.test(u)
  const bit10 = /10bit|10-bit/i.test(u)
  const encoder =
    match1(u, /\.(PSA|YIFY|KyoGo|ETHEL|RARBG|FLUX|CMRG)(?:\.|$)/i) ||
    match1(u, /[\/._-](PSA|YIFY|KyoGo|ETHEL)[\/._-]/i)
  return { quality, audio, source, codec, hdr: Boolean(hdr), bit10: Boolean(bit10), encoder }
}

export function extractQuality(text) {
  const t = String(text)
  if (/\b2160p\b|\b4K\b/i.test(t)) return '2160p'
  const m = t.match(/\b(1080p|720p|480p|360p)\b/i)
  return m ? m[1] : null
}

function match1(s, re) {
  const m = String(s).match(re)
  return m ? m[1] : null
}
