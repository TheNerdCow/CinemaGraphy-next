import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCinemetaClient,
  metahubPoster,
  metahubBackground,
  upgradePosterUrl,
} from '../../src/core/meta/cinemeta.js'

test('metahubPoster builds public URL without API key', () => {
  assert.equal(
    metahubPoster('tt0133093'),
    'https://images.metahub.space/poster/medium/tt0133093/img',
  )
  assert.equal(metahubPoster('not-imdb'), undefined)
})

test('metahubBackground builds public URL', () => {
  assert.equal(
    metahubBackground('tt0133093'),
    'https://images.metahub.space/background/medium/tt0133093/img',
  )
})

test('upgradePosterUrl prefers metahub when imdb present', () => {
  assert.match(upgradePosterUrl('http://example/poster.jpg', 'tt1'), /metahub/)
})

test('cinemeta byImdb returns null on invalid id without throwing', async () => {
  const client = createCinemetaClient({
    http: {
      get: async () => {
        throw new Error('should not be called')
      },
    },
  })
  assert.equal(await client.byImdb('bad'), null)
})

test('cinemeta search returns null when upstream empty', async () => {
  const client = createCinemetaClient({
    http: {
      get: async () => ({
        ok: true,
        json: async () => ({ metas: [] }),
      }),
    },
  })
  assert.equal(await client.search('zzzz-no-hit'), null)
})

test('cinemeta search returns null on timeout/error', async () => {
  const client = createCinemetaClient({
    http: {
      get: async () => {
        throw new Error('network')
      },
    },
  })
  assert.equal(await client.search('Matrix'), null)
})

test('cinemeta byImdb normalizes meta with metahub poster', async () => {
  const client = createCinemetaClient({
    http: {
      get: async () => ({
        ok: true,
        json: async () => ({
          meta: {
            id: 'tt0133093',
            name: 'The Matrix',
            type: 'movie',
            poster: 'http://example/small.jpg',
          },
        }),
      }),
    },
  })
  const m = await client.byImdb('tt0133093', 'movie')
  assert.equal(m.imdb, 'tt0133093')
  assert.match(m.poster, /metahub.*tt0133093/)
})
