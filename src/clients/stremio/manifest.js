/**
 * Stremio manifest builder from AppConfig + provider registry capabilities.
 */

import { movieGenreNames, seriesGenreNames } from '../../providers/f2media/genres.js'

/** Providers that already ship dedicated browse catalogs (no generic _movies/_series). */
const BROWSE_ONLY_KEYS = new Set(['cinamatic', 'aslmoviez', 'avamovie', 'digimovie'])

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
  const lang = config.ui?.lang || 'fa'

  if (config.resources.catalog) {
    for (const p of providers) {
      if (p.capabilities?.search && !BROWSE_ONLY_KEYS.has(p.key)) {
        const movieGenres =
          p.key === 'f2media' ? movieGenreNames() : p.capabilities.movieGenres || []
        const seriesGenres =
          p.key === 'f2media' ? seriesGenreNames() : p.capabilities.seriesGenres || []

        const movieExtra = [
          { name: 'genre', options: movieGenres, isRequired: false },
          { name: 'search', isRequired: false },
          { name: 'skip', isRequired: false },
        ]
        catalogs.push({
          id: `${p.key}_movies`,
          type: 'movie',
          name: lang === 'en' ? `${p.name} Movies` : `${p.name} — فیلم`,
          extra: movieExtra.filter((e) => e.name !== 'genre' || (e.options && e.options.length)),
        })

        const seriesExtra = [
          { name: 'genre', options: seriesGenres, isRequired: false },
          { name: 'search', isRequired: false },
          { name: 'skip', isRequired: false },
        ]
        catalogs.push({
          id: `${p.key}_series`,
          type: 'series',
          name: lang === 'en' ? `${p.name} Series` : `${p.name} — سریال`,
          extra: seriesExtra.filter((e) => e.name !== 'genre' || (e.options && e.options.length)),
        })
      }
      for (const c of p.capabilities?.browseCatalogs || []) {
        catalogs.push(c)
      }
    }
  }

  const description =
    config.mode === 'streams'
      ? 'CinemaGraphy Next — streams only (sources).'
      : lang === 'fa'
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
