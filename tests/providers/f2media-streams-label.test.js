import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseDetailStreams, parseDetailMeta, formatStreamLabel } from '../../src/providers/f2media/parse.js'

const dir = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(
  '/home/workdir/attachments',
  'دانلود فیلم ماتریکس The Matrix 1999 بدون سانسور با زیرنویس فارسی چسبیده.html',
)

test('formatStreamLabel has quality and audio', () => {
  const s = formatStreamLabel({
    quality: '1080p',
    audio: 'dub',
    source: 'BluRay',
    codec: 'x265',
  })
  assert.match(s, /1080p/)
  assert.match(s, /دوبله/)
  assert.match(s, /BluRay/)
})

test('parse real matrix page streams when fixture exists', () => {
  let html
  try {
    html = readFileSync(fixturePath, 'utf8')
  } catch {
    // fixture only on agent machine — skip silently in CI clone
    return
  }
  const streams = parseDetailStreams(html, 'https://www.film2med.top')
  assert.ok(streams.length >= 5, `expected streams, got ${streams.length}`)
  assert.ok(streams.some((s) => /1080/i.test(s.quality || s.label)))
  assert.ok(streams.some((s) => s.audio === 'dub'))
  assert.ok(streams.some((s) => s.audio === 'sub'))
  assert.ok(streams.every((s) => /\.mkv/i.test(s.url) || /abrtech/i.test(s.url)))

  const meta = parseDetailMeta(html, 'https://www.film2med.top')
  assert.ok(meta.poster, 'schema poster')
  assert.ok(!meta.description || !/دانلود فیلم بدون سانسور , دانلود رایگان/i.test(meta.description))
})
