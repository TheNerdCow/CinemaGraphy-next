import assert from 'node:assert/strict'
import test from 'node:test'
import { applyMode, defaultConfig } from '../../src/core/config/app-config.js'
import { buildStremioManifest } from '../../src/clients/stremio/manifest.js'

const sampleProviders = [
  {
    key: 'f2media',
    name: 'F2Media',
    capabilities: { search: true, streams: true, browseCatalogs: [] },
  },
]

test('full mode includes catalog resource and search catalogs', () => {
  const cfg = applyMode({ ...defaultConfig(), mode: 'full' })
  const m = buildStremioManifest(cfg, sampleProviders)
  assert.ok(m.resources.includes('catalog') || m.resources.some((r) => r === 'catalog'))
  assert.ok(m.catalogs.some((c) => c.id === 'f2media_movies'))
})

test('streams mode has no catalogs list', () => {
  const cfg = applyMode({ ...defaultConfig(), mode: 'streams' })
  const m = buildStremioManifest(cfg, sampleProviders)
  assert.equal(m.catalogs.length, 0)
  assert.ok(m.resources.some((r) => r === 'stream' || r?.name === 'stream'))
  assert.ok(!m.resources.includes('catalog'))
})
