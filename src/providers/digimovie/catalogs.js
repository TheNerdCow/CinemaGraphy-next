/** DigiMovie editorial catalogs — cookie auth + rotatable base URL. */

/** @typedef {{ id: string, type: 'movie'|'series', kind: string, nameFa: string, path: string }} DigiCatalog */

/** @type {DigiCatalog[]} */
export const DIGI_CATALOGS = [
  {
    id: 'digimovie_movies',
    type: 'movie',
    kind: 'movies',
    nameFa: 'DigiMovie — فیلم',
    path: '/movies/',
  },
  {
    id: 'digimovie_series',
    type: 'series',
    kind: 'series',
    nameFa: 'DigiMovie — سریال',
    path: '/series/',
  },
  {
    id: 'digimovie_anime',
    type: 'series',
    kind: 'anime',
    nameFa: 'DigiMovie — انیمه',
    path: '/category/انیمه/',
  },
  {
    id: 'digimovie_korean',
    type: 'series',
    kind: 'korean',
    nameFa: 'DigiMovie — سریال کره‌ای',
    path: '/category/سریال-کره-ای/',
  },
  {
    id: 'digimovie_indian',
    type: 'movie',
    kind: 'indian',
    nameFa: 'DigiMovie — فیلم هندی',
    path: '/category/فیلم-هندی/',
  },
]

export function getCatalogById(id) {
  return DIGI_CATALOGS.find((c) => c.id === id) || null
}

export function toManifestCatalogs() {
  return DIGI_CATALOGS.map((c) => ({
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
  let path = catalog.path.startsWith('/') ? catalog.path : `/${catalog.path}`
  // keep unicode category paths; ensure trailing slash for page 1
  if (page <= 1) {
    return root + (path.endsWith('/') ? path : path + '/')
  }
  const basePath = path.replace(/\/+$/, '')
  return `${root}${basePath}/page/${page}/`
}
