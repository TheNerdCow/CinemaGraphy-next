/**
 * SSRF guards for server-side fetches.
 * Blocks private, link-local, metadata, and non-http(s) destinations.
 */

import { isIP } from 'node:net'

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
])

export function validateFetchUrl(rawUrl) {
  let url
  try {
    url = new URL(String(rawUrl))
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'scheme_not_allowed' }
  }

  const host = url.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost') || host.endsWith('.local')) {
    return { ok: false, reason: 'blocked_hostname' }
  }

  const ipVersion = isIP(host)
  if (ipVersion) {
    if (isPrivateOrSpecialIp(host, ipVersion)) {
      return { ok: false, reason: 'private_or_special_ip' }
    }
  }

  return { ok: true, url }
}

function isPrivateOrSpecialIp(host, version) {
  if (version === 4) {
    const parts = host.split('.').map(Number)
    const [a, b] = parts
    if (a === 10) return true
    if (a === 127) return true
    if (a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a >= 224) return true
    return false
  }
  const h = host.toLowerCase()
  if (h === '::1') return true
  if (h.startsWith('fc') || h.startsWith('fd')) return true
  if (h.startsWith('fe80')) return true
  return false
}
