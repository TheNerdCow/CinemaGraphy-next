/**
 * F2Media editorial catalogs — order matches homepage rails.
 * Search is attached to updated movies/series (no separate duplicate rails).
 */

/** @typedef {{ id: string, type: 'movie'|'series', nameFa: string, nameEn: string, path: string, homeRail?: number, searchable?: boolean }} F2Catalog */

/** @type {F2Catalog[]} */
export const F2_CATALOGS = [
  {
    id: 'f2media_movies_updated',
    type: 'movie',
    nameFa: 'F2Media — فیلم‌های به روز شده',
    nameEn: 'F2Media — Updated Movies',
    path: '/movies/',
    homeRail: 1,
    searchable: true,
  },
  {
    id: 'f2media_series_updated',
    type: 'series',
    nameFa: 'F2Media — سریال‌های به روز شده',
    nameEn: 'F2Media — Updated Series',
    path: '/series/',
    homeRail: 2,
    searchable: true,
  },
  {
    id: 'f2media_top_movies',
    type: 'movie',
    nameFa: 'F2Media — برترین فیلم‌ها',
    nameEn: 'F2Media — Top Movies',
    path: '/category/f2m-top-movies/',
    homeRail: 3,
  },
  {
    id: 'f2media_korean',
    type: 'series',
    nameFa: 'F2Media — سریال‌های کره‌ای',
    nameEn: 'F2Media — Korean Series',
    path: '/category/korean-tv-series/',
    homeRail: 5,
  },
  {
    id: 'f2media_turkish',
    type: 'series',
    nameFa: 'F2Media — سریال‌های ترکی',
    nameEn: 'F2Media — Turkish Series',
    path: '/category/turkish-tv-series/',
    homeRail: 6,
  },
  {
    id: 'f2media_anime',
    type: 'series',
    nameFa: 'F2Media — انیمه',
    nameEn: 'F2Media — Anime',
    path: '/category/anime-series/',
    homeRail: 7,
  },
  {
    id: 'f2media_chinese',
    type: 'series',
    nameFa: 'F2Media — سریال‌های چینی',
    nameEn: 'F2Media — Chinese Series',
    path: '/category/chinese_series/',
    homeRail: 8,
  },
  {
    id: 'f2media_dubbed',
    type: 'movie',
    nameFa: 'F2Media — فیلم‌های دوبله فارسی',
    nameEn: 'F2Media — Persian Dubbed',
    path: '/movies/?dubbled=1',
    homeRail: 9,
  },
  {
    id: 'f2media_coming_soon',
    type: 'movie',
    nameFa: 'F2Media — به زودی',
    nameEn: 'F2Media — Coming Soon',
    path: '/category/coming-soon/',
    homeRail: 10,
  },
]

export function getCatalogById(id) {
  return F2_CATALOGS.find((c) => c.id === id) || null
}

export function toManifestCatalogs(lang = 'fa') {
  return F2_CATALOGS.map((c) => {
    const extra = [{ name: 'skip', isRequired: false }]
    if (c.searchable) {
      extra.unshift({ name: 'search', isRequired: false })
    }
    return {
      id: c.id,
      type: c.type,
      name: lang === 'en' ? c.nameEn : c.nameFa,
      extra,
    }
  })
}

export function catalogListUrl(base, catalog, page = 1) {
  const root = String(base).replace(/\/+$/, '')
  const path = catalog.path
  if (page <= 1) return root + path
  if (path.includes('?')) {
    const [p, qs] = path.split('?')
    const clean = p.endsWith('/') ? p : p + '/'
    return root + clean + 'page/' + page + '/?' + qs
  }
  const clean = path.endsWith('/') ? path : path + '/'
  return root + clean + 'page/' + page + '/'
}
