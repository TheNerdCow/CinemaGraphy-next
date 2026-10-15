/**
 * In-memory CacheStore with TTL.
 */

export function createMemoryCache() {
  const map = new Map()

  function purge(key) {
    const e = map.get(key)
    if (!e) return
    if (Date.now() > e.expires) map.delete(key)
  }

  return {
    get(key) {
      purge(key)
      return map.get(key)?.value
    },
    set(key, value, ttlMs = 60_000) {
      map.set(key, { value, expires: Date.now() + Math.max(0, ttlMs) })
    },
    delete(key) {
      map.delete(key)
    },
    clear() {
      map.clear()
    },
    size() {
      return map.size
    },
  }
}
