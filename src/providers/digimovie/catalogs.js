/** DigiMovie editorial catalogs — cookie auth + rotatable base URL. */

/** @typedef {{ id: string, type: 'movie'|'series', kind: string, nameFa: string, path: string, altPaths?: string[] }} DigiCatalog */

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
    altPaths: [
      '/category/anime/',
      '/category/انیمیشن/',
    ],
  },
  {
    id: 'digimovie_korean',
    type: 'series',
    kind: 'korean',
    nameFa: 'DigiMovie — سریال کره‌ای',
    path: '/category/سریال-کره-ای/',
    altPaths: [
      '/category/korean/',
      '/category/korean-series/',
      '/category/کره-ای/',
      '/category/سریال-کره/',
    ],
  },
  {
    id: 'digimovie_indian',
    type: 'movie',
    kind: 'indian',
    nameFa: 'DigiMovie — فیلم هندی',
    path: '/category/فیلم-هندی/',
    altPaths: ['/category/indian/', '/category/هندی/'],
  },
]

export const DIGI_MOVIE_GENRES = [
  'اکشن', 'انیمیشن', 'بیوگرافی', 'ترسناک', 'جنایی', 'درام', 'کمدی',
  'علمی تخیلی', 'فانتزی', 'ماجراجویی', 'معمایی', 'هیجان انگیز',
  'عاشقانه', 'جنگی', 'مستند', 'خانوادگی', 'وسترن', 'ورزشی',
]

export const DIGI_SERIES_GENRES = [
  'اکشن', 'انیمیشن', 'ترسناک', 'جنایی', 'درام', 'کمدی',
  'علمی تخیلی', 'فانتزی', 'ماجراجویی', 'معمایی', 'هیجان انگیز',
  'عاشقانه', 'خانوادگی',
]

export const DIGI_GENRE_SLUGS = {
  اکشن: 'اکشن',
  انیمیشن: 'انیمیشن',
  بیوگرافی: 'بیوگرافی',
  ترسناک: 'ترسناک',
  جنایی: 'جنایی',
  درام: 'درام',
  کمدی: 'کمدی',
  'علمی تخیلی': 'علمی-تخیلی',
  فانتزی: 'فانتزی',
  ماجراجویی: 'ماجراجویی',
  معمایی: 'معمایی',
  'هیجان انگیز': 'هیجان-انگیز',
  عاشقانه: 'عاشقانه',
  جنگی: 'جنگی',
  مستند: 'مستند',
  خانوادگی: 'خانوادگی',
  وسترن: 'وسترن',
  ورزشی: 'ورزشی',
}

export const DIGI_PAGE_SIZE = 12

export function getCatalogById(id) {
  return DIGI_CATALOGS.find((c) => c.id === id) || null
}

export function toManifestCatalogs() {
  return DIGI_CATALOGS.map((c) => {
    const extra = [
      { name: 'search', isRequired: false },
      { name: 'skip', isRequired: false },
    ]
    if (c.kind === 'movies' || c.kind === 'indian') {
      extra.unshift({
        name: 'genre',
        options: DIGI_MOVIE_GENRES,
        isRequired: false,
      })
    } else if (c.kind === 'series') {
      extra.unshift({
        name: 'genre',
        options: DIGI_SERIES_GENRES,
        isRequired: false,
      })
    }
    return {
      id: c.id,
      type: c.type,
      name: c.nameFa,
      extra,
    }
  })
}

export function catalogListUrl(base, catalog, page = 1) {
  const root = String(base).replace(/\/+$/, '')
  let path = catalog.path.startsWith('/') ? catalog.path : '/' + catalog.path
  if (page <= 1) {
    return root + (path.endsWith('/') ? path : path + '/')
  }
  const basePath = path.replace(/\/+$/, '')
  return root + basePath + '/page/' + page + '/'
}

export function catalogPathCandidates(catalog, page = 1) {
  const paths = [catalog.path, ...(catalog.altPaths || [])]
  const out = []
  for (const p of paths) {
    let path = p.startsWith('/') ? p : '/' + p
    if (page <= 1) {
      out.push(path.endsWith('/') || path.includes('?') ? path : path + '/')
    } else {
      const basePath = path.split('?')[0].replace(/\/+$/, '')
      const qs = path.includes('?') ? '?' + path.split('?')[1] : ''
      out.push(basePath + '/page/' + page + '/' + qs)
    }
  }
  return out
}

export function genreListPaths(genreLabel, type, page = 1) {
  const slug = DIGI_GENRE_SLUGS[genreLabel] || genreLabel
  const encoded = encodeURI(slug)
  const pageSuffix = page <= 1 ? '/' : '/page/' + page + '/'
  const paths = [
    '/genre/' + encoded + pageSuffix,
    '/category/' + encoded + pageSuffix,
    '/tag/' + encoded + pageSuffix,
  ]
  if (type === 'series') {
    paths.unshift('/genre/' + encoded + pageSuffix + '?archive_filter_type=series')
  } else if (type === 'movie') {
    paths.unshift('/genre/' + encoded + pageSuffix + '?archive_filter_type=movie')
  }
  return paths
}
