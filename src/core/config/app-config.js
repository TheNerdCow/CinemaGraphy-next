/**
 * Typed application config + merge rules.
 * Modes: full | streams | catalogs
 *
 * No mandatory API keys. Cinemeta is the metadata source (public, keyless).
 */

import { ADDON_MODES } from '../models/types.js'

const SENSITIVE_KEYS = new Set([
  'cookie',
  'password',
  'DIGIMOVIE_COOKIE',
  'AVAMOVIE_COOKIE',
])

export function defaultConfig() {
  return {
    mode: 'full',
    resources: {
      catalog: true,
      meta: true,
      stream: true,
      subtitles: false,
    },
    providersEnabled: [],
    providers: {},
    meta: { lang: 'fa' },
    ui: { lang: 'fa' },
    timeouts: { providerMs: 15_000 },
    nameSuffix: '',
    addonName: 'سینماگرافی',
    addonId: 'com.cinemagraphy.next',
    version: '0.2.8',
    externalCatalogs: [],
    browseCatalogs: {},
  }
}

export function applyMode(cfg) {
  const out = structuredClone(cfg)
  if (!ADDON_MODES.includes(out.mode)) out.mode = 'full'

  if (out.mode === 'streams') {
    out.resources.catalog = false
    out.resources.stream = true
    if (out.resources.meta === undefined) out.resources.meta = true
    if (!out.nameSuffix) out.nameSuffix = ' · Streams'
    if (out.addonId === 'com.cinemagraphy.next') {
      out.addonId = 'com.cinemagraphy.next.streams'
    }
  } else if (out.mode === 'catalogs') {
    out.resources.catalog = true
    out.resources.stream = false
    out.resources.meta = true
    if (!out.nameSuffix) out.nameSuffix = ' · Catalogs'
  } else {
    out.resources.catalog = true
    out.resources.stream = true
    out.resources.meta = true
  }
  return out
}

export function configFromEnv(env = process.env, overlay = {}) {
  const base = defaultConfig()

  const mode = String(env.ADDON_MODE || overlay.mode || 'full').toLowerCase()
  if (ADDON_MODES.includes(mode)) base.mode = mode

  if (env.ADDON_NAME) base.addonName = String(env.ADDON_NAME)
  if (env.ADDON_ID) base.addonId = String(env.ADDON_ID)
  if (env.ADDON_VERSION) base.version = String(env.ADDON_VERSION)
  if (env.ADDON_NAME_SUFFIX) base.nameSuffix = String(env.ADDON_NAME_SUFFIX)

  if (env.META_LANG === 'en' || env.META_LANG === 'fa') base.meta.lang = env.META_LANG
  if (env.UI_LANG === 'en' || env.UI_LANG === 'fa') base.ui.lang = env.UI_LANG

  const timeout = Number(env.PROVIDER_TIMEOUT_MS)
  if (Number.isFinite(timeout) && timeout > 0) base.timeouts.providerMs = timeout

  if (env.ENABLED_PROVIDERS) {
    base.providersEnabled = String(env.ENABLED_PROVIDERS)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  for (const [key, value] of Object.entries(env)) {
    const m = /^([A-Z0-9]+)_BASEURL$/.exec(key)
    if (!m || !value) continue
    const normalized = m[1].toLowerCase().replace(/_/g, '')
    if (!base.providers[normalized]) base.providers[normalized] = {}
    base.providers[normalized].baseUrl = String(value).replace(/\/+$/, '')
    base.providers[normalized].enabled = true
  }

  const merged = deepMerge(base, overlay || {})
  return applyMode(merged)
}

export function decodeUserConfig(encoded) {
  if (!encoded) return null
  try {
    const json = Buffer.from(String(encoded), 'base64url').toString('utf8')
    const obj = JSON.parse(json)
    if (!obj || typeof obj !== 'object') return null

    const out = {}
    if (ADDON_MODES.includes(obj.mode)) out.mode = obj.mode
    if (obj.resources && typeof obj.resources === 'object') {
      out.resources = {
        catalog: Boolean(obj.resources.catalog),
        meta: Boolean(obj.resources.meta),
        stream: Boolean(obj.resources.stream),
        subtitles: Boolean(obj.resources.subtitles),
      }
    }
    if (Array.isArray(obj.providersEnabled)) {
      out.providersEnabled = obj.providersEnabled.map(String).filter(Boolean)
    }
    if (obj.meta && typeof obj.meta === 'object') {
      out.meta = {
        lang: obj.meta.lang === 'en' ? 'en' : 'fa',
      }
    }
    if (obj.ui && typeof obj.ui === 'object') {
      out.ui = { lang: obj.ui.lang === 'en' ? 'en' : 'fa' }
    }
    if (typeof obj.nameSuffix === 'string') out.nameSuffix = obj.nameSuffix
    if (typeof obj.addonName === 'string') out.addonName = obj.addonName
    if (obj.timeouts?.providerMs) {
      out.timeouts = { providerMs: Number(obj.timeouts.providerMs) || 15_000 }
    }
    return Object.keys(out).length ? out : null
  } catch {
    return null
  }
}

export function redactSecrets(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj || {})) {
    if (SENSITIVE_KEYS.has(k) && v != null && String(v).trim()) {
      const s = String(v)
      out[k] = s.length <= 8 ? '***' : `${s.slice(0, 4)}…***`
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redactSecrets(v)
    } else {
      out[k] = v
    }
  }
  return out
}

export function isProviderEnabled(config, providerKey) {
  const p = config.providers[providerKey]
  if (p && p.enabled === false) return false
  if (!config.providersEnabled.length) {
    return Boolean(p?.baseUrl || p?.enabled)
  }
  return config.providersEnabled.includes(providerKey)
}

function deepMerge(a, b) {
  const out = structuredClone(a)
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object') {
      out[k] = deepMerge(out[k], v)
    } else if (v !== undefined) {
      out[k] = v
    }
  }
  return out
}
