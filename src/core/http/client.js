/**
 * HttpClient — timeout, size limit, SSRF, safe manual redirects.
 * Always re-applies caller headers (Cookie) on every hop — undici "follow"
 * can drop cookies across hosts and infinite Location loops raise
 * "redirect count exceeded".
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
    Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7',
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
    const seen = new Set()
    const chain = []
    const headers = { ...defaultHeaders, ...(init.headers || {}) }
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
      if (seen.has(normalized)) {
        const err = new Error(`Redirect loop at ${normalized}`)
        err.code = 'REDIRECT_LOOP'
        err.chain = chain
        throw err
      }
      seen.add(normalized)

      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), init.timeoutMs ?? timeoutMs)
      try {
        const res = await fetch(normalized, {
          method,
          headers,
          redirect: 'manual',
          signal: ac.signal,
        })

        chain.push({ url: normalized, status: res.status })

        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const loc = res.headers.get('location')
          // drain body so socket can reuse
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
          current = new URL(loc, normalized).toString()
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
