import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { defaultConfig, configFromEnv } from '../../src/core/config/app-config.js'
import { buildStremioManifest } from '../../src/clients/stremio/manifest.js'

test('package.json version is 0.2.7', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.version, '0.2.7')
})

test('defaultConfig version is 0.2.7', () => {
  assert.equal(defaultConfig().version, '0.2.7')
})

test('manifest uses config version', () => {
  const cfg = configFromEnv({ ADDON_VERSION: '0.2.7' })
  const m = buildStremioManifest(cfg, [])
  assert.equal(m.version, '0.2.7')
  assert.ok(m.id)
  assert.ok(Array.isArray(m.resources))
})
