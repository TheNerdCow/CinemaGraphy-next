/**
 * HttpClient with timeout, size limit, SSRF validation, browser UA, polite spacing.
 */

import { validateFetchUrl } from './ssrf.js'

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_BYTES = 2.5 * 1024 * 1024
const MAX_REDIRECTS = 5

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export function createHttpClient(opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
  const minGapMs = opts.minGapMs ?? 120
  let lastAt = 0
  let chain = Promise.resolve()

  const defaultHeaders = opts.defaultHeaders ?? {
    'User-Agent': BROWSER_UA,
    Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
  }

  async function throttle() {
    const wait = Math.max(0, minGapMs - (Date.now() - lastAt))
    if (wait) await new Promise((r) => setTimeout(r, wait))
    lastAt = Date.now()
  }

  async function request(url, init = {}) {
    // Serialize outbound requests slightly to avoid looking like a scraper burst
    const run = chain.then(async () => {
      await throttle()
      return requestOnce(url, init)
    })
    chain = run.catch(() => {})
    return run
  }

  async function requestOnce(url, init = {}) {
    let current = url
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const check = validateFetchUrl(current)
      if (!check.ok) {
        const err = new Error(`SSRF blocked: ${check.reason}`)
        err.code = 'SSRF_BLOCKED'
        throw err
      }

      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), init.timeoutMs ?? timeoutMs)
      try {
        const res = await fetch(check.url.toString(), {
          ...init,
          method: init.method || 'GET',
          headers: { ...defaultHeaders, ...(init.headers || {}) },
          redirect: 'manual',
          signal: ac.signal,
        })

        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const loc = res.headers.get('location')
          if (!loc) {
            const err = new Error('Redirect without Location')
            err.code = 'BAD_REDIRECT'
            throw err
          }
          current = new URL(loc, check.url).toString()
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
          url: check.url.toString(),
          arrayBuffer: () => buf,
          text: () => new TextDecoder('utf-8').decode(buf),
          json: () => JSON.parse(new TextDecoder('utf-8').decode(buf)),
        }
      } finally {
        clearTimeout(t)
      }
    }
    const err = new Error('Too many redirects')
    err.code = 'TOO_MANY_REDIRECTS'
    throw err
  }

  return {
    get: (url, init) => request(url, { ...init, method: 'GET' }),
    request,
  }
}
