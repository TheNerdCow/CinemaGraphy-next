import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createTmdbClient } from '../../src/core/meta/tmdb.js'
import { configFromEnv, defaultConfig } from '../../src/core/config/app-config.js'
import { createF2MediaProvider } from '../../src/providers/f2media/index.js'

test('tmdb stub is disabled and returns null', async () => {
  const c = createTmdbClient({ apiKey: 'fake' })
  assert.equal(c.enabled, false)
  assert.equal(await c.search('Matrix'), null)
  assert.equal(await c.byImdb('tt0133093'), null)
})

test('configFromEnv does not require or store TMDB_API_KEY', () => {
  const c = configFromEnv({ TMDB_API_KEY: 'should-be-ignored', PORT: '7000' })
  assert.equal(c.meta.tmdbKey, undefined)
  assert.equal(defaultConfig().version, '0.2.7')
})

test('f2media source has no tmdb import in normal path', () => {
  const src = readFileSync(new URL('../../src/providers/f2media/index.js', import.meta.url), 'utf8')
  assert.ok(!src.includes('createTmdbClient'))
  assert.ok(!src.includes('tmdb.js'))
  assert.ok(src.includes('createCinemetaClient'))
})

test('movie streams still returned when cinemeta fails', async () => {
  const detailHtml = `
    <html><head>
    <meta property="og:title" content="دانلود فیلم The Matrix 1999" />
    </head><body>
    <div class="download-list hardsub">
      <a href="https://cdn.example.com/matrix.1080p.mp4">1080p</a>
      <a href="https://cdn.example.com/matrix.720p.mp4">720p</a>
    </div>
    </body></html>`

  const provider = createF2MediaProvider({
    http: {
      get: async (url) => {
        if (String(url).includes('film2med') || String(url).includes('example')) {
          return {
            ok: true,
            status: 200,
            text: async () => detailHtml,
          }
        }
        throw new Error('unexpected ' + url)
      },
    },
    cinemeta: {
      search: async () => null,
      byImdb: async () => null,
    },
  })

  // encode page path as item id
  const { encodePageId } = await import('../../src/providers/f2media/parse.js')
  const itemId = encodePageId('1289/the-matrix-1999')
  const detail = await provider.getDetail(itemId, 'movie', { config: {} })
  assert.ok(detail)
  assert.equal(detail.type, 'movie')
  assert.ok(detail.streams.length >= 2, 'streams without meta')
  assert.equal(detail.poster, undefined)

  const streams = await provider.getStreams(detail)
  assert.equal(streams.length, detail.streams.length)
})
