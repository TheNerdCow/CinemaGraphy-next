/**
 * Simple in-memory TTL cache (no external deps).
 */

export function createMemoryCache(defaultTtlMs = 10 * 60_000) {
  const store = new Map()

  function get(key) {
    const e = store.get(key)
    if (!e) return undefined
    if (Date.now() > e.exp) {
      store.delete(key)
      return undefined
    }
    return e.value
  }

  function set(key, value, ttlMs = defaultTtlMs) {
    store.set(key, { value, exp: Date.now() + ttlMs })
    return value
  }

  async function wrap(key, fn, ttlMs = defaultTtlMs) {
    const hit = get(key)
    if (hit !== undefined) return hit
    const value = await fn()
    if (value !== undefined && value !== null) set(key, value, ttlMs)
    return value
  }

  function clear() {
    store.clear()
  }

  return { get, set, wrap, clear, size: () => store.size }
}
