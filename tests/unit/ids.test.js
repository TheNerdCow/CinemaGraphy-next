import assert from 'node:assert/strict'
import test from 'node:test'
import {
  makeInternalId,
  parseInternalId,
  toStremioProviderId,
  fromStremioProviderId,
} from '../../src/core/ids/namespace.js'

test('roundtrip internal id', () => {
  const id = makeInternalId('f2media', 'abc123')
  const p = parseInternalId(id)
  assert.equal(p?.providerKey, 'f2media')
  assert.equal(p?.itemId, 'abc123')
})

test('stremio id mapping', () => {
  const s = toStremioProviderId('cinamatic', 'page-1')
  assert.equal(s, 'ipcinamatic___page-1')
  const back = fromStremioProviderId(s)
  assert.equal(back?.providerKey, 'cinamatic')
  assert.equal(back?.itemId, 'page-1')
})
