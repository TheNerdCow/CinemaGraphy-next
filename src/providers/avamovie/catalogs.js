/** AvaMovie (avadel.top) editorial catalogs — cookie auth required. */

/** @typedef {{ id: string, type: 'movie'|'series', kind: string, nameFa: string, path: string }} AvaCatalog */

/** @type {AvaCatalog[]} */
export const AVA_CATALOGS = [
  {
    id: 'avamovie_movies',
    type: 'movie',
    kind: 'movies',
    nameFa: 'AvaMovie — فیلم',
    path: '/movies/',
  },
  {
    id: 'avamovie_series',
    type: 'series',
    kind: 'series',
    nameFa: 'AvaMovie — سریال',
    path: '/series/',
  },
  {
    id: 'avamovie_anime',
    type: 'series',
    kind: 'anime',
    nameFa: 'AvaMovie — انیمه',
    path: '/anime/',
  },
  {
    id: 'avamovie_korean',
    type: 'series',
    kind: 'korean',
    nameFa: 'AvaMovie — سریال کره‌ای',
    path: '/east-asian-series/',
  },
  {
    id: 'avamovie_movie_dub',
    type: 'movie',
    kind: 'movie_dub',
    nameFa: 'AvaMovie — فیلم دوبله',
    path: '/movie-dub/',
  },
]

/** ژانر فیلم از منوی سایت */
export const AVA_MOVIE_GENRES = [
  'اکشن',
  'انیمیشن',
  'بیوگرافی',
  'تاریخی',
  'ترسناک',
  'جنایی',
  'جنگی',
  'خانوادگی',
  'درام',
  'رازآلود',
  'عاشقانه',
  'علمی‌و‌تخیلی',
  'فانتزی',
  'کمدی',
  'ماجراجویی',
  'مستند',
  'معمایی',
  'هیجان انگیز',
  'ورزشی',
  'وسترن',
]

/** ژانر سریال از منوی سایت */
export const AVA_SERIES_GENRES = [
  'اکشن',
  'انیمیشن',
  'بیوگرافی',
  'تاریخی',
  'ترسناک',
  'جنایی',
  'جنگی',
  'خانوادگی',
  'درام',
  'رازآلود',
  'عاشقانه',
  'علمی‌و‌تخیلی',
  'فانتزی',
  'کمدی',
  'ماجراجویی',
  'مستند',
  'معمایی',
  'هیجان انگیز',
  'ورزشی',
  'وسترن',
]

/** Map display genre → site slug (URL-encoded path segment uses Persian) */
export const AVA_GENRE_SLUGS = {
  'اکشن': 'اکشن',
  'انیمیشن': 'انیمیشن',
  'بیوگرافی': 'بیوگرافی',
  'تاریخی': 'تاریخی',
  'ترسناک': 'ترسناک',
  'جنایی': 'جنایی',
  'جنگی': 'جنگی',
  'خانوادگی': 'خانوادگی',
  'درام': 'درام',
  'رازآلود': 'رازآلود',
  'عاشقانه': 'عاشقانه',
  'علمی‌و‌تخیلی': 'علمی-و-تخیلی',
  'فانتزی': 'فانتزی',
  'کمدی': 'کمدی',
  'ماجراجویی': 'ماجراجویی',
  'مستند': 'مستند',
  'معمایی': 'معمایی',
  'هیجان انگیز': 'هیجان-انگیز',
  'ورزشی': 'ورزشی',
  'وسترن': 'وسترن',
}

export function getCatalogById(id) {
  return AVA_CATALOGS.find((c) => c.id === id) || null
}

export function toManifestCatalogs() {
  return AVA_CATALOGS.map((c) => {
    const extra = [
      { name: 'search', isRequired: false },
      { name: 'skip', isRequired: false },
    ]
    if (c.kind === 'movies' || c.kind === 'movie_dub') {
      extra.unshift({ name: 'genre', options: AVA_MOVIE_GENRES, isRequired: false })
    } else if (c.kind === 'series') {
      extra.unshift({ name: 'genre', options: AVA_SERIES_GENRES, isRequired: false })
    }
    return {
      id: c.id,
      type: c.type,
      name: c.nameFa,
      extra,
    }
  })
}

/** /movies/, /movies/page/2/, genre with archive_filter_type */
export function catalogListUrl(base, catalog, page = 1) {
  const root = String(base).replace(/\/+$/, '')
  let path = catalog.path.startsWith('/') ? catalog.path : `/${catalog.path}`
  path = path.replace(/\/+$/, '') + '/'
  if (page <= 1) return root + path
  return `${root}${path}page/${page}/`
}

export function genreListUrl(base, type, genreLabel, page = 1) {
  const root = String(base).replace(/\/+$/, '')
  const slug = AVA_GENRE_SLUGS[genreLabel] || genreLabel
  const filter = type === 'series' ? 'series' : 'movie'
  const encoded = encodeURI(slug)
  if (page <= 1) {
    return `${root}/genre/${encoded}/?archive_filter_type=${filter}`
  }
  return `${root}/genre/${encoded}/page/${page}/?archive_filter_type=${filter}`
}
