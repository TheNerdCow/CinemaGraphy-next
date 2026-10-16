/**
 * F2Media genre slugs — from site /genres/{slug}/?type=movie|series
 * Labels shown in Stremio/Nuvio genre picker (Persian).
 */

/** @typedef {{ slug: string, nameFa: string }} F2Genre */

/** @type {F2Genre[]} */
export const MOVIE_GENRES = [
  { slug: 'action', nameFa: 'اکشن' },
  { slug: 'adventure', nameFa: 'ماجراجویی' },
  { slug: 'animation', nameFa: 'انیمیشن' },
  { slug: 'anime', nameFa: 'انیمه' },
  { slug: 'biography', nameFa: 'بیوگرافی' },
  { slug: 'comedy', nameFa: 'کمدی' },
  { slug: 'crime', nameFa: 'جنایی' },
  { slug: 'documentary', nameFa: 'مستند' },
  { slug: 'drama', nameFa: 'درام' },
  { slug: 'family', nameFa: 'خانوادگی' },
  { slug: 'fantasy', nameFa: 'فانتزی' },
  { slug: 'film-noir', nameFa: 'فیلم‌نوآر' },
  { slug: 'history', nameFa: 'تاریخی' },
  { slug: 'horror', nameFa: 'ترسناک' },
  { slug: 'music', nameFa: 'موزیک' },
  { slug: 'musical', nameFa: 'موزیکال' },
  { slug: 'mystery', nameFa: 'معمایی' },
  { slug: 'romance', nameFa: 'عاشقانه' },
  { slug: 'sci-fi', nameFa: 'علمی تخیلی' },
  { slug: 'short', nameFa: 'کوتاه' },
  { slug: 'sport', nameFa: 'ورزشی' },
  { slug: 'supernatural', nameFa: 'فراطبیعی' },
  { slug: 'thriller', nameFa: 'هیجان‌انگیز' },
  { slug: 'war', nameFa: 'جنگی' },
  { slug: 'western', nameFa: 'وسترن' },
  { slug: 'talk-show', nameFa: 'تاک‌شو' },
  { slug: 'reality-tv', nameFa: 'برنامه تلویزیونی' },
]

/** @type {F2Genre[]} */
export const SERIES_GENRES = [
  { slug: 'action', nameFa: 'اکشن' },
  { slug: 'adventure', nameFa: 'ماجراجویی' },
  { slug: 'animation', nameFa: 'انیمیشن' },
  { slug: 'anime', nameFa: 'انیمه' },
  { slug: 'biography', nameFa: 'بیوگرافی' },
  { slug: 'children', nameFa: 'کودک و نوجوان' },
  { slug: 'comedy', nameFa: 'کمدی' },
  { slug: 'crime', nameFa: 'جنایی' },
  { slug: 'documentary', nameFa: 'مستند' },
  { slug: 'drama', nameFa: 'درام' },
  { slug: 'espionage', nameFa: 'جاسوسی' },
  { slug: 'family', nameFa: 'خانوادگی' },
  { slug: 'fantasy', nameFa: 'فانتزی' },
  { slug: 'food', nameFa: 'غذا' },
  { slug: 'game-show', nameFa: 'مسابقه‌ها' },
  { slug: 'history', nameFa: 'تاریخی' },
  { slug: 'horror', nameFa: 'ترسناک' },
  { slug: 'legal', nameFa: 'حقوقی' },
  { slug: 'medical', nameFa: 'پزشکی' },
  { slug: 'music', nameFa: 'موزیک' },
  { slug: 'musical', nameFa: 'موزیکال' },
  { slug: 'mystery', nameFa: 'معمایی' },
  { slug: 'nature', nameFa: 'طبیعت' },
  { slug: 'reality-tv', nameFa: 'برنامه تلویزیونی' },
  { slug: 'romance', nameFa: 'عاشقانه' },
  { slug: 'sci-fi', nameFa: 'علمی تخیلی' },
  { slug: 'science-fiction', nameFa: 'science-fiction' },
  { slug: 'short', nameFa: 'کوتاه' },
  { slug: 'sport', nameFa: 'ورزشی' },
  { slug: 'sports', nameFa: 'sports' },
  { slug: 'supernatural', nameFa: 'فراطبیعی' },
  { slug: 'talk-show', nameFa: 'تاک‌شو' },
  { slug: 'thriller', nameFa: 'هیجان‌انگیز' },
  { slug: 'travel', nameFa: 'سفر' },
  { slug: 'war', nameFa: 'جنگی' },
  { slug: 'western', nameFa: 'وسترن' },
]

export function movieGenreNames() {
  return MOVIE_GENRES.map((g) => g.nameFa)
}

export function seriesGenreNames() {
  return SERIES_GENRES.map((g) => g.nameFa)
}

/** Resolve Persian label or English slug → genre entry */
export function resolveGenre(labelOrSlug, type) {
  const list = type === 'series' ? SERIES_GENRES : MOVIE_GENRES
  const q = String(labelOrSlug || '').trim().toLowerCase()
  if (!q) return null
  return (
    list.find((g) => g.slug === q) ||
    list.find((g) => g.nameFa === labelOrSlug) ||
    list.find((g) => g.nameFa.toLowerCase() === q) ||
    null
  )
}

export function genreListUrl(base, type, slug, page = 1) {
  const root = String(base).replace(/\/+$/, '')
  const t = type === 'series' ? 'series' : 'movie'
  if (page <= 1) return `${root}/genres/${slug}/?type=${t}`
  return `${root}/genres/${slug}/page/${page}/?type=${t}`
}
