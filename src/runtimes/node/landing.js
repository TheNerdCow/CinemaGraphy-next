/**
 * Landing page — restored via parts after accidental truncate on GitHub.
 */
import { ASSET_BG, ASSET_MARK, ASSET_FAV, ASSET_DIGI_FAV } from './landing-assets.js'
import { PART0 } from './landing-part-0.js'
import { PART1 } from './landing-part-1.js'
import { PART2 } from './landing-part-2.js'
import { PART3 } from './landing-part-3.js'

const FULL = PART0 + PART1 + PART2 + PART3

export function renderLanding(opts = {}) {
  const stripped = FULL
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
