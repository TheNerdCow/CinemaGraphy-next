import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseSearchHtml,
  parseDetailStreams,
  parseDetailMeta,
  encodePageId,
  decodePageId,
} from '../../src/providers/f2media/parse.js'

const dir = dirname(fileURLToPath(import.meta.url))
const searchHtml = readFileSync(join(dir, 'fixtures/f2media-search-sample.html'), 'utf8')
const detailHtml = readFileSync(join(dir, 'fixtures/f2media-detail-sample.html'), 'utf8')
const base = 'https://www.film2med.top'

test('parseSearchHtml extracts movies and series from fixture', () => {
  const items = parseSearchHtml(searchHtml, base)
  assert.ok(items.length >= 2)
  const matrix = items.find((i) => /matrix/i.test(i.title) && i.year === 1999)
  assert.ok(matrix, 'expected Matrix 1999')
  assert.equal(matrix.type, 'movie')
  assert.ok(matrix.itemId)
  assert.equal(decodePageId(matrix.itemId), matrix.pagePath)
  const series = items.find((i) => i.type === 'series')
  assert.ok(series, 'expected a series hit')
})

test('parseSearchHtml ignores genre/nav links', () => {
  const items = parseSearchHtml(searchHtml, base)
  assert.ok(!items.some((i) => /genres\/action/i.test(i.pagePath)))
})

test('parseDetailMeta reads og:title and imdb', () => {
  const meta = parseDetailMeta(detailHtml)
  assert.match(meta.title || '', /Matrix/i)
  assert.equal(meta.imdb, 'tt0133093')
})

test('parseDetailStreams keeps media urls only', () => {
  const streams = parseDetailStreams(detailHtml, base)
  assert.equal(streams.length, 2)
  assert.ok(streams.every((s) => /\.mp4$/i.test(s.url)))
})

test('page id roundtrip', () => {
  const id = encodePageId('movie/the-matrix-1999')
  assert.equal(decodePageId(id), 'movie/the-matrix-1999')
  assert.equal(decodePageId('not-valid!!!'), null)
})
