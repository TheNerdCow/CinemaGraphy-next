/**
 * Provider registry — register modules by key.
 */

const registry = new Map()

export function registerProvider(provider) {
  if (!provider?.key) throw new Error('Provider must have key')
  registry.set(provider.key, provider)
}

export function getProvider(key) {
  return registry.get(key) || null
}

export function listProviders() {
  return [...registry.values()]
}

export function listEnabledProviders(config) {
  return listProviders().filter((p) => {
    if (typeof p.isEnabled === 'function') return p.isEnabled(config)
    return true
  })
}

export function _clearRegistry() {
  registry.clear()
}
