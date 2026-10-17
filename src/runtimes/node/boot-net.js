/**
 * Network boot helpers — call once at process start.
 * Windows/Node often prefers broken IPv6 and fails with opaque "fetch failed".
 */

import dns from 'node:dns'

export function bootNetwork() {
  try {
    if (typeof dns.setDefaultResultOrder === 'function') {
      dns.setDefaultResultOrder('ipv4first')
    }
  } catch {
    /* ignore */
  }
}

/** Flatten undici / Node fetch errors for debug JSON. */
export function describeFetchError(err) {
  if (!err) return { error: 'unknown' }
  const out = {
    error: err.name === 'AbortError' ? 'timeout' : String(err.message || err),
  }
  const c = err.cause
  if (c) {
    out.cause = c.code || c.message || String(c)
    if (c.errno) out.errno = c.errno
    if (c.syscall) out.syscall = c.syscall
    if (c.hostname) out.hostname = c.hostname
    if (c.address) out.address = c.address
    if (c.port) out.port = c.port
  }
  return out
}
