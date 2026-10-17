/**
 * Ephemeral in-memory store for local debug cookies (AvaMovie / DigiMovie).
 * Not durable across process restart. Do not use as production auth.
 */

const store = new Map()
const MAX_ENTRIES = 50
const TTL_MS = 12 * 60 * 60 * 1000 // 12h

function prune() {
  const now = Date.now()
  for (const [k, v] of store) {
    if (!v || now - v.ts > TTL_MS) store.delete(k)
  }
  while (store.size > MAX_ENTRIES) {
    const first = store.keys().next().value
    store.delete(first)
  }
}

export function setSessionCookie(providerKey, cookie) {
  prune()
  const key = String(providerKey || '').toLowerCase()
  const val = String(cookie || '').trim()
  if (!key) return { ok: false, error: 'missing provider' }
  if (!val) {
    store.delete(key)
    return { ok: true, cleared: true, hasCookie: false }
  }
  store.set(key, { cookie: val.slice(0, 8192), ts: Date.now() })
  return { ok: true, hasCookie: true, len: val.length }
}

export function getSessionCookie(providerKey) {
  prune()
  const entry = store.get(String(providerKey || '').toLowerCase())
  if (!entry?.cookie) return ''
  if (Date.now() - entry.ts > TTL_MS) {
    store.delete(String(providerKey || '').toLowerCase())
    return ''
  }
  return entry.cookie
}

export function hasSessionCookie(providerKey) {
  return Boolean(getSessionCookie(providerKey))
}
