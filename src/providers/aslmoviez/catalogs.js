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
]

/** ژانرهای منوی فیلم روی سایت (دسته بندی‌ها → فیلم). */
export const ASL_MOVIE_GENRES = [
  'اکشن',
  'ترسناک',
  'فانتزی',
  'درام',
  'وسترن',
  'کمدی',
  'هیجان انگیز',
  'معمایی',
  'خانوادگی',
  'مستند',
  'انیمیشن',
  'ماجراجویی',
  'جنایی',
  'ورزشی',
  'علمی تخیلی',
]

/** ژانرهای منوی سریال روی سایت (دسته بندی‌ها → سریال). */
export const ASL_SERIES_GENRES = [
  'اکشن',
  'هیجان انگیز',
  'جنایی',
  'عاشقانه',
  'معمایی',
  'کمدی',
  'تاریخی',
  'خانوادگی',
  'ماجراجویی',
  'ورزشی',
  'انیمیشن',
  'ترسناک',
  'درام',
  'علمی تخیلی',
  'مستند',
]

export function getCatalogById(id) {
  return ASL_CATALOGS.find((c) => c.id === id) || null
}

export function toManifestCatalogs() {
  return ASL_CATALOGS.map((c) => {
    const extra = [
      { name: 'search', isRequired: false },
      { name: 'skip', isRequired: false },
    ]
    // Genre dropdown only on film / series (not the dedicated anime rail)
    if (c.kind === 'film') {
      extra.unshift({ name: 'genre', options: ASL_MOVIE_GENRES, isRequired: false })
    } else if (c.kind === 'series') {
      extra.unshift({ name: 'genre', options: ASL_SERIES_GENRES, isRequired: false })
    }
    return {
      id: c.id,
      type: c.type,
      name: c.nameFa,
      extra,
    }
  })
}

/** Build list URL: /film, /film/page/2, /genre/anime/page/2 */
export function catalogListUrl(base, catalog, page = 1) {
  const root = String(base).replace(/\/+$/, '')
  let path = catalog.path.startsWith('/') ? catalog.path : `/${catalog.path}`
  path = path.replace(/\/+$/, '')
  if (page <= 1) return root + path
  return `${root}${path}/page/${page}`
}
