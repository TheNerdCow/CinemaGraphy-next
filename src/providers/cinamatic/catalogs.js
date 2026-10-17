/** Cinamatic editorial catalogs — only three category rails. */

/** @typedef {{ id: string, type: 'movie'|'series', kind: 'film'|'series'|'anime', nameFa: string, path: string }} CinaCatalog */

/** @type {CinaCatalog[]} */
export const CINA_CATALOGS = [
  {
    id: 'cinamatic_film',
    type: 'movie',
    kind: 'film',
    nameFa: 'Cinamatic — فیلم',
    path: '/category/film/',
  },
  {
    id: 'cinamatic_series',
    type: 'series',
    kind: 'series',
    nameFa: 'Cinamatic — سریال',
    path: '/category/series/',
  },
  {
    id: 'cinamatic_anime',
    type: 'series',
    kind: 'anime',
    nameFa: 'Cinamatic — انیمه',
    path: '/category/anime/',
  },
]

export function getCatalogById(id) {
  return CINA_CATALOGS.find((c) => c.id === id) || null
}

export function toManifestCatalogs() {
  return CINA_CATALOGS.map((c) => ({
    id: c.id,
    type: c.type,
    name: c.nameFa,
    extra: [
      { name: 'search', isRequired: false },
      { name: 'skip', isRequired: false },
    ],
  }))
}

export function catalogListUrl(base, catalog, page = 1) {
  const root = String(base).replace(/\/+$/, '')
  const path = catalog.path.endsWith('/') ? catalog.path : catalog.path + '/'
  if (page <= 1) return root + path
  return `${root}${path}page/${page}/`
}
