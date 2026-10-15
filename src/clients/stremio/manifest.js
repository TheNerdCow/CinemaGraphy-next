/**
 * Stremio manifest builder from AppConfig + provider registry capabilities.
 */

export function buildStremioManifest(config, providers = []) {
  const name = [config.addonName, config.nameSuffix].filter(Boolean).join('')
  const resources = []

  if (config.resources.catalog) {
    resources.push('catalog')
  }
  if (config.resources.meta) {
    resources.push({
      name: 'meta',
      types: ['movie', 'series', 'tv'],
      idPrefixes: ['ip', 'tt', 'cg:'],
    })
  }
  if (config.resources.stream) {
    resources.push({
      name: 'stream',
      types: ['movie', 'series', 'tv'],
      idPrefixes: ['ip', 'tt', 'cg:'],
    })
  }
  if (config.resources.subtitles) {
    resources.push({
      name: 'subtitles',
      types: ['movie', 'series'],
      idPrefixes: ['ip', 'tt', 'cg:'],
    })
  }

  const catalogs = []

  if (config.resources.catalog) {
    for (const p of providers) {
      if (!p.capabilities?.search) continue
      catalogs.push({
        id: `${p.key}_movies`,
        type: 'movie',
        name: p.name || p.key,
        extra: [{ name: 'search', isRequired: true }],
      })
      catalogs.push({
        id: `${p.key}_series`,
        type: 'series',
        name: p.name || p.key,
        extra: [{ name: 'search', isRequired: true }],
      })
      for (const c of p.capabilities.browseCatalogs || []) {
        catalogs.push(c)
      }
    }
  }

  const description =
    config.mode === 'streams'
      ? 'CinemaGraphy Next — streams only (sources). Use another addon for catalogs if needed.'
      : config.ui.lang === 'fa'
        ? 'سینماگرافی (نسخهٔ مستقل ماژولار) — فیلم و سریال از منابع ایرانی'
        : 'CinemaGraphy Next — modular independent rewrite'

  return {
    id: config.addonId,
    version: config.version,
    name,
    description,
    logo: 'https://raw.githubusercontent.com/TheNerdCow/CinemaGraphy/refs/heads/master/logo.png',
    resources,
    types: ['movie', 'series', 'tv'],
    catalogs,
    behaviorHints: {
      configurable: true,
      configurationRequired: false,
      p2p: false,
    },
  }
}
