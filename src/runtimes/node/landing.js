/**
 * CinemaGraphy NEXT — Complete Liquid Glass Modern RTL Landing Page
 */
import { ASSET_BG, ASSET_MARK, ASSET_FAV, ASSET_DIGI_FAV } from './landing-assets.js'

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
}

export function renderLanding(opts = {}) {
  // NOTE: truncated restore marker - full content follows in next push if needed
  const free = opts.freeProviders ?? ['f2media', 'aslmoviez', 'zardfilm']
  return `<!DOCTYPE html><html><body><h1>RESTORING</h1><p>Use local landing.js</p></body></html>`
}
