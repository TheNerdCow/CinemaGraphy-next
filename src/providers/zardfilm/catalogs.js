/** ZardFilm (zardfilm.in) — non-Iranian catalogs only. */

/** @typedef {{ id: string, type: 'movie'|'series', nameFa: string, path: string }} ZfCatalog */

/** Genre label (fa) → site path under /genre/… or absolute path */
export const ZF_GENRE_PATHS = {
  'درام': '/genre/drama1',
  'هیجانی': '/genre/' + encodeURIComponent('هیجانی'),
  'اکشن': '/genre/action',
  'کمدی': '/genre/comedy',
  'جنایی': '/genre/crime',
  'معمایی': '/genre/puzzle',
  'ترسناک': '/genre/scary',
  'فانتزی': '/genre/fantasy',
  'خانوادگی': '/genre/family',
  'علمی تخیلی': '/genre/fiction',
  'عاشقانه': '/genre/romantic',
  'ماجراجویی': '/genre/adventure',
  'تاریخی': '/genre/' + encodeURIComponent('تاریخی'),
  'اجتماعی': '/genre/social',
  'هندی': '/genre/hindi',
  'مستند': '/genre/' + encodeURIComponent('مستند'),
  'جنگی': '/genre/' + encodeURIComponent('جنگی'),
  'انیمیشن': '/animation',
}

export const ZF_GENRES = Object.keys(ZF_GENRE_PATHS)

/** @type {ZfCatalog[]} */
export const ZF_CATALOGS = [
  {
    id: 'zardfilm_foreign_sub',
    type: 'movie',
    nameFa: 'ZardFilm — فیلم خارجی',
    path: '/foreign-subbed-movies',
  },
  {
    id: 'zardfilm_dubbed',
    type: 'movie',
    nameFa: 'ZardFilm — دوبله فارسی',
    path: '/dubbed-fa',
  },
  {
    id: 'zardfilm_animation',
    type: 'movie',
    nameFa: 'ZardFilm — انیمیشن و کارتون',
    path: '/animation',
  },
  {
    id: 'zardfilm_anime',
    type: 'series',
    nameFa: 'ZardFilm — انیمه',
    path: '/anime',
  },
  {
    id: 'zardfilm_series_foreign',
    type: 'series',
    nameFa: 'ZardFilm — سریال خارجی',
    path: '/%D8%B3%D8%B1%DB%8C%D8%A7%D9%84-%D8%AE%D8%A7%D8%B1%D8%AC%DB%8C',
  },
  {
    id: 'zardfilm_series_dubbed',
    type: 'series',
    nameFa: 'ZardFilm — سریال دوبله',
    path: '/dubbed-series',
  },
  {
    id: 'zardfilm_series_korean',
    type: 'series',
    nameFa: 'ZardFilm — سریال کره‌ای',
    path: '/korean-series',
  },
  {
    id: 'zardfilm_series_turkish',
    type: 'series',
    nameFa: 'ZardFilm — سریال ترکی',
    path: '/%D8%B3%D8%B1%DB%8C%D8%A7%D9%84-%D8%AA%D8%B1%DA%A9%DB%8C',
  },
  {
    id: 'zardfilm_series_chinese',
    type: 'series',
    nameFa: 'ZardFilm — سریال چینی',
    path: '/%D8%B3%D8%B1%DB%8C%D8%A7%D9%84-%DA%86%DB%8C%D9%86%DB%8C',
  },
]

export function getCatalogById(id) {
  return ZF_CATALOGS.find((c) => c.id === id) || null
}

export function genrePath(genre) {
  const g = String(genre || '').trim()
  return ZF_GENRE_PATHS[g] || null
}

export function toManifestCatalogs() {
  return ZF_CATALOGS.map((c) => {
    const extra = [
      { name: 'search', isRequired: false },
      { name: 'skip', isRequired: false },
    ]
    // genre filter on main film/series rails (newest-on-site default order)
    if (
      c.id === 'zardfilm_foreign_sub' ||
      c.id === 'zardfilm_dubbed' ||
      c.id === 'zardfilm_series_foreign' ||
      c.id === 'zardfilm_series_dubbed'
    ) {
      extra.unshift({ name: 'genre', options: ZF_GENRES, isRequired: false })
    }
    return {
      id: c.id,
      type: c.type,
      name: c.nameFa,
      extra,
    }
  })
}

/** /path/, /path/page/2/ — site default order is newest */
export function catalogListUrl(base, catalog, page = 1) {
  const root = String(base).replace(/\/+$/, '')
  let path = typeof catalog === 'string' ? catalog : catalog.path
  path = path.startsWith('/') ? path : `/${path}`
  path = path.replace(/\/+$/, '')
  if (page <= 1) return root + path + '/'
  return `${root}${path}/page/${page}/`
}
