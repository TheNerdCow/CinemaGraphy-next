/**
 * HttpClient — timeout, size limit, SSRF, safe manual redirects.
 *
 * Critical: intermediate 3xx responses often set cookies (WAF / LiteSpeed /
 * WordPress). Undici "follow" and naive manual follow that only resend the
 * original Cookie header can loop on 307→same-URL. We merge Set-Cookie into
 * the jar for subsequent hops.
 */

import { validateFetchUrl } from './ssrf.js'

const DEFAULT_TIMEOUT_MS = 12_000
const DEFAULT_MAX_BYTES = 2.5 * 1024 * 1024
const MAX_REDIRECTS = 12

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export function createHttpClient(opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
  const maxConcurrent = opts.maxConcurrent ?? 6
  let active = 0
  const waiters = []

  const defaultHeaders = opts.defaultHeaders ?? {
    'User-Agent': BROWSER_UA,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  }

  async function slot() {
    if (active < maxConcurrent) {
      active++
      return
    }
    await new Promise((resolve) => waiters.push(resolve))
    active++
  }

  function release() {
    active--
    const next = waiters.shift()
    if (next) next()
  }

  async function request(url, init = {}) {
    await slot()
    try {
      return await requestOnce(url, init)
    } finally {
      release()
    }
  }

  async function requestOnce(url, init = {}) {
    let current = String(url)
    const seen = new Map() // url -> hit count (allow one retry after cookie merge)
    const chain = []
    const baseHeaders = { ...defaultHeaders, ...(init.headers || {}) }
    const jar = cookieJarFromHeader(baseHeaders.Cookie || baseHeaders.cookie || '')
    const method = init.method || 'GET'
    const limit = init.maxRedirects ?? MAX_REDIRECTS

    for (let i = 0; i <= limit; i++) {
      const check = validateFetchUrl(current)
      if (!check.ok) {
        const err = new Error(`SSRF blocked: ${check.reason}`)
        err.code = 'SSRF_BLOCKED'
        throw err
      }

      const normalized = check.url.toString()
      const hits = seen.get(normalized) || 0
      if (hits >= 2) {
        const err = new Error(`Redirect loop at ${normalized}`)
        err.code = 'REDIRECT_LOOP'
        err.chain = chain
        throw err
      }
      seen.set(normalized, hits + 1)

      const headers = { ...baseHeaders }
      const cookieStr = jarToHeader(jar)
      if (cookieStr) headers.Cookie = cookieStr
      else delete headers.Cookie

      // After first hop, site is same-origin navigation
      if (i > 0) {
        headers['Sec-Fetch-Site'] = 'same-origin'
        headers['Sec-Fetch-Mode'] = 'navigate'
        headers['Sec-Fetch-Dest'] = 'document'
      }

      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), init.timeoutMs ?? timeoutMs)
      try {
        const res = await fetch(normalized, {
          method,
          headers,
          redirect: 'manual',
          signal: ac.signal,
        })

        mergeSetCookie(jar, res.headers)

        chain.push({
          url: normalized,
          status: res.status,
          setCookie: countSetCookie(res.headers),
        })

        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const loc = res.headers.get('location')
          try {
            await res.arrayBuffer()
          } catch {
            /* ignore */
          }
          if (!loc) {
            const err = new Error('Redirect without Location')
            err.code = 'BAD_REDIRECT'
            err.chain = chain
            throw err
          }
          const next = new URL(loc, normalized).toString()
          // Same URL 307 often means "retry with new cookies" — allow one more hit
          current = next
          continue
        }

        const buf = await res.arrayBuffer()
        if (buf.byteLength > maxBytes) {
          const err = new Error('Response too large')
          err.code = 'RESPONSE_TOO_LARGE'
          throw err
        }

        return {
          status: res.status,
          ok: res.ok,
          headers: res.headers,
          url: normalized,
          chain,
          arrayBuffer: () => buf,
          text: () => new TextDecoder('utf-8').decode(buf),
          json: () => JSON.parse(new TextDecoder('utf-8').decode(buf)),
        }
      } finally {
        clearTimeout(t)
      }
    }

    const err = new Error(`Too many redirects (${limit})`)
    err.code = 'TOO_MANY_REDIRECTS'
    err.chain = chain
    throw err
  }

  return {
    get: (url, init) => request(url, { ...init, method: 'GET' }),
    request,
  }
}

function cookieJarFromHeader(cookieHeader) {
  const jar = new Map()
  const raw = String(cookieHeader || '').trim()
  if (!raw) return jar
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=')
    if (idx <= 0) continue
    const name = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (!name) continue
    jar.set(name, value)
  }
  return jar
}

function jarToHeader(jar) {
  if (!jar || jar.size === 0) return ''
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

function mergeSetCookie(jar, headers) {
  // Node fetch: getSetCookie() when available; else fall back to get('set-cookie')
  let list = []
  if (typeof headers.getSetCookie === 'function') {
    list = headers.getSetCookie() || []
  } else {
    const single = headers.get('set-cookie')
    if (single) list = [single]
  }
  for (const line of list) {
    const first = String(line).split(';')[0]
    const idx = first.indexOf('=')
    if (idx <= 0) continue
    const name = first.slice(0, idx).trim()
    const value = first.slice(idx + 1).trim()
    if (!name) continue
    // deletion
    if (!value || /deleted/i.test(value)) {
      jar.delete(name)
    } else {
      jar.set(name, value)
    }
  }
}

function countSetCookie(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return (headers.getSetCookie() || []).length
  }
  return headers.get('set-cookie') ? 1 : 0
}
