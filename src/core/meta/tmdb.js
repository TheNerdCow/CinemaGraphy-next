/**
 * TMDB is intentionally NOT part of the normal runtime path.
 * Kept as an inert stub so accidental imports do not crash and do not call TMDB.
 * Posters/metadata use Cinemeta + MetaHub only (no API key).
 */

export function createTmdbClient(_deps = {}) {
  return {
    enabled: false,
    async search() {
      return null
    },
    async byImdb() {
      return null
    },
  }
}
