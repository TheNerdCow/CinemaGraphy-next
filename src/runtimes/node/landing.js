/**
 * CinemaGraphy NEXT landing — base64-restored (full UI + ZardFilm status).
 */
import { ASSET_BG, ASSET_MARK, ASSET_FAV, ASSET_DIGI_FAV } from './landing-assets.js'
import { B0 } from './landing-b64-0.js'
import { B1 } from './landing-b64-1.js'
import { B2 } from './landing-b64-2.js'
import { B3 } from './landing-b64-3.js'
import { B4 } from './landing-b64-4.js'

const SRC = Buffer.from(B0 + B1 + B2 + B3 + B4, 'base64').toString('utf8')

export function renderLanding(opts = {}) {
  const stripped = SRC
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*/m, '')
    .replace(/export\s+function\s+renderLanding/, 'function renderLanding')
  const runner = new Function(
    'ASSET_BG',
    'ASSET_MARK',
    'ASSET_FAV',
    'ASSET_DIGI_FAV',
    'opts',
    stripped + '\nreturn renderLanding(opts);',
  )
  return runner(ASSET_BG, ASSET_MARK, ASSET_FAV, ASSET_DIGI_FAV, opts)
}
