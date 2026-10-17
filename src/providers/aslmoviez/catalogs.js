/** AslMoviez editorial catalogs. */

/** @typedef {{ id: string, type: 'movie'|'series', kind: string, nameFa: string, path: string, query?: string }} AslCatalog */

/** @type {AslCatalog[]} */
export const ASL_CATALOGS = [
  {
    id: 'aslmoviez_film',
    type: 'movie',
    kind: 'film',
    nameFa: 'AslMoviez — فیلم',
    path: '/film',
  },
  {
    id: 'aslmoviez_series',
    type: 'series',
    kind: 'series',
    nameFa: 'AslMoviez — سریال',
    path: '/series',
  },
  {
    id: 'aslmoviez_anime',
    type: 'series',
    kind: 'anime',
    nameFa: 'AslMoviez — انیمه',
    path: '/genre/anime',
  },
  {
    id: 'aslmoviez_doc',
    type: 'movie',
    kind: 'doc',
    nameFa: 'AslMoviez — مستند',
    path: '/%d9%85%d8%b3%d8%aa%d9%86%d8%af',
  },
]

/** Genre labels used on /film and /series filters (Discover extra). */
export const ASL_MOVIE_GENRES = [
  'درام',
  'اکشن',
  'کمدی',
  'ماجراجویی',
  'هیجان انگیز',
  'جنایی',
  'فانتزی',
  'ترسناک',
  'علمی تخیلی',
  'عاشقانه',
  'خانوادگی',
  'جنگی',
  'زندگی‌نامه',
  'معمایی',
  'تاریخی',
]

export const ASL_SERIES_GENRES = [
  'درام',
  'اکشن',
  'کمدی',
  'ماجراجویی',
  'هیجان انگیز',
  'جنایی',
  'فانتزی',
  'ترسناک',
  'انیمه',
  'تاریخی',
  'بیوگرافی',
  'معمایی',
]

export function getCatalogById(id) {
  return ASL_CATALOGS.find((c) => c.id === id) || null
}

export function toManifestCatalogs() {
  return ASL_CATALOGS.map((c) => ({
    id: c.id,
    type: c.type,
    name: c.nameFa,
    extra: [
      { name: 'search', isRequired: false },
      { name: 'skip', isRequired: false },
    ],
  }))
}

/** Build list URL: /film, /film/page/2, /genre/anime/page/2 */
export function catalogListUrl(base, catalog, page = 1) {
  const root = String(base).replace(/\/+$/, '')
  let path = catalog.path.startsWith('/') ? catalog.path : `/${catalog.path}`
  path = path.replace(/\/+$/, '')
  if (page <= 1) return root + path
  return `${root}${path}/page/${page}`
}
