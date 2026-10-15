/**
 * Placeholder provider — contract demo without scraping.
 */

import { makeInternalId } from '../core/ids/namespace.js'

export const stubExampleProvider = {
  key: 'stub',
  name: 'Stub Example',
  capabilities: {
    search: true,
    browseCatalogs: [],
    streams: true,
    providerMeta: false,
    auth: 'none',
  },

  isEnabled(config) {
    if (config.providers.stub?.enabled) return true
    if (config.providersEnabled.includes('stub')) return true
    return process.env.STUB_ENABLE === '1'
  },

  async search(query) {
    const q = String(query || '').trim()
    if (!q) return []
    return [
      {
        internalId: makeInternalId('stub', 'demo-1'),
        type: 'movie',
        title: `Stub result for: ${q}`,
        year: 2024,
        providerKey: 'stub',
      },
    ]
  },

  async getDetail(itemId) {
    return { id: itemId, title: 'Stub Detail', type: 'movie' }
  },

  async getStreams() {
    return []
  },
}
