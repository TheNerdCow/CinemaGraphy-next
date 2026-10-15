import assert from 'node:assert/strict'
import test from 'node:test'
import { validateFetchUrl } from '../../src/core/http/ssrf.js'

test('allows public https', () => {
  const r = validateFetchUrl('https://example.com/path')
  assert.equal(r.ok, true)
})

test('blocks localhost', () => {
  assert.equal(validateFetchUrl('http://localhost/x').ok, false)
  assert.equal(validateFetchUrl('http://127.0.0.1/').ok, false)
})

test('blocks private ipv4', () => {
  assert.equal(validateFetchUrl('http://192.168.1.1/').ok, false)
  assert.equal(validateFetchUrl('http://10.0.0.5/').ok, false)
})

test('blocks file scheme', () => {
  assert.equal(validateFetchUrl('file:///etc/passwd').ok, false)
})
