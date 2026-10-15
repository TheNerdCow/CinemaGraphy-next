import assert from 'node:assert/strict'
import test from 'node:test'
import {
  defaultConfig,
  applyMode,
  configFromEnv,
  decodeUserConfig,
  isProviderEnabled,
} from '../../src/core/config/app-config.js'

test('default mode is full with catalog+stream', () => {
  const c = applyMode(defaultConfig())
  assert.equal(c.mode, 'full')
  assert.equal(c.resources.catalog, true)
  assert.equal(c.resources.stream, true)
})

test('streams mode disables catalog and suffixes name', () => {
  const c = applyMode({ ...defaultConfig(), mode: 'streams' })
  assert.equal(c.resources.catalog, false)
  assert.equal(c.resources.stream, true)
  assert.match(c.nameSuffix, /Streams/)
  assert.match(c.addonId, /streams/)
})

test('catalogs mode disables stream', () => {
  const c = applyMode({ ...defaultConfig(), mode: 'catalogs' })
  assert.equal(c.resources.catalog, true)
  assert.equal(c.resources.stream, false)
})

test('configFromEnv reads F2MEDIA_BASEURL', () => {
  const c = configFromEnv({ F2MEDIA_BASEURL: 'https://example.com/' })
  assert.equal(c.providers.f2media.baseUrl, 'https://example.com')
  assert.equal(c.providers.f2media.enabled, true)
})

test('decodeUserConfig mode overlay', () => {
  const payload = Buffer.from(JSON.stringify({ mode: 'streams' }), 'utf8').toString('base64url')
  const overlay = decodeUserConfig(payload)
  assert.equal(overlay?.mode, 'streams')
})

test('isProviderEnabled respects allow-list', () => {
  const c = applyMode({
    ...defaultConfig(),
    providersEnabled: ['f2media'],
    providers: { f2media: { baseUrl: 'https://x', enabled: true }, other: { baseUrl: 'https://y', enabled: true } },
  })
  assert.equal(isProviderEnabled(c, 'f2media'), true)
  assert.equal(isProviderEnabled(c, 'other'), false)
})
