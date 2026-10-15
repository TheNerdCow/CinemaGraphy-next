/**
 * Stable internal IDs. Client adapters map these to Stremio/Nuvio forms.
 * Internal: cg:{providerKey}:{opaqueItemId}
 * Stremio series stream: ip{provider}___{itemId}:{season}:{episode}
 */

const PREFIX = 'cg'

export function makeInternalId(providerKey, itemId) {
  const p = sanitizePart(providerKey)
  const i = sanitizePart(itemId)
  return `${PREFIX}:${p}:${i}`
}

export function parseInternalId(internalId) {
  const s = String(internalId || '')
  const parts = s.split(':')
  if (parts.length < 3 || parts[0] !== PREFIX) return null
  const providerKey = parts[1]
  if (parts[2] === 'v') return null
  const itemId = parts[2]
  let videoRef
  if (parts[3] === 'v' && parts[4] != null) {
    videoRef = parts.slice(4).join(':')
  }
  return { providerKey, itemId, videoRef }
}

export function toStremioProviderId(providerKey, itemId) {
  return `ip${sanitizePart(providerKey)}___${String(itemId)}`
}

/**
 * Parse Stremio id, including series episode suffix :season:episode
 */
export function fromStremioProviderId(stremioId) {
  let s = String(stremioId || '')
  if (!s.startsWith('ip')) return null

  let season
  let episode
  // trailing :12:3 or :1:01
  const epMatch = s.match(/:(\d+):(\d+)$/)
  if (epMatch) {
    season = Number(epMatch[1])
    episode = Number(epMatch[2])
    s = s.slice(0, -epMatch[0].length)
  }

  const body = s.slice(2)
  const idx = body.indexOf('___')
  if (idx < 0) return null
  const providerKey = body.slice(0, idx)
  const after = body.slice(idx + 3)
  const restIdx = after.indexOf('___')
  if (restIdx >= 0) {
    return {
      providerKey,
      itemId: after.slice(0, restIdx),
      rest: after.slice(restIdx + 3),
      season,
      episode,
    }
  }
  return { providerKey, itemId: after, season, episode }
}

function sanitizePart(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9._~-]/g, '_')
    .slice(0, 200)
}
