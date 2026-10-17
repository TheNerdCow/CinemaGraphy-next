/**
 * Deep AvaMovie connectivity debug (raw host probes + provider browse).
 */

import { createHttpClient } from '../../core/http/client.js'
import { parseListingHtml as parseAvaListing } from '../../providers/avamovie/parse.js'

export async function runAvaMovieDebug({ config, provider, version }) {
  const cookie =
    config.providers?.avamovie?.cookie || process.env.AVAMOVIE_COOKIE || ''
  const preferred =
    config.providers?.avamovie?.baseUrl ||
    process.env.AVAMOVIE_BASEURL ||
    'https://avadel.top'

  if (!cookie) {
    return {
      ok: false,
      error: 'no cookie — use landing form or AVAMOVIE_COOKIE',
      version,
    }
  }

  const hosts = [
    preferred.replace(/\/+$/, ''),
    'https://avadel.top',
    'https://avamovie.shop',
  ].filter((v, i, a) => a.indexOf(v) === i)

  const http = createHttpClient({ timeoutMs: 25_000 })
  const probes = []

  for (const base of hosts) {
    const url = `${base}/movies/`
    const started = Date.now()
    try {
      const r = await http.get(url, {
        timeoutMs: 25_000,
        headers: {
          Cookie: cookie,
          Referer: `${base}/`,
          Origin: base,
        },
      })
      const html = r.ok ? await r.text() : ''
      const itemMovie = (html.match(/item-movie/gi) || []).length
      const titleEn = (html.match(/title_en/gi) || []).length
      const parsed = itemMovie ? parseAvaListing(html, base, 'movie') : []
      probes.push({
        base,
        url,
        finalUrl: r.url,
        status: r.status,
        ms: Date.now() - started,
        htmlLen: html.length,
        itemMovie,
        titleEn,
        chain: r.chain || [],
        hasLoginForm: /name=["']log|login-form|ورود به حساب/i.test(html),
        hasBuySub: /buy-subscription|خرید اشتراک/i.test(html),
        parsed: parsed.length,
        sampleTitles: parsed.slice(0, 5).map((p) => p.title),
        titleSnippet: (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]
          ?.replace(/\s+/g, ' ')
          .trim()
          .slice(0, 80),
      })
    } catch (err) {
      probes.push({
        base,
        url,
        ms: Date.now() - started,
        error: err.message,
        code: err.code || undefined,
        chain: err.chain || undefined,
        cause: err.cause?.code || err.cause?.message || undefined,
      })
    }
  }

  let providerCount = 0
  let providerSample = []
  let providerError = null
  try {
    const items = await provider.browse('avamovie_movies', {
      config,
      skip: 0,
      timeoutMs: 25_000,
    })
    providerCount = items.length
    providerSample = items.slice(0, 5).map((i) => ({
      title: i.title,
      year: i.year,
      hasPoster: Boolean(i.poster),
    }))
  } catch (err) {
    providerError = err.message
  }

  const best = probes.find((p) => p.parsed > 0)
  return {
    ok: providerCount > 0 || Boolean(best),
    version,
    cookiePresent: true,
    cookieLen: cookie.length,
    preferredBase: preferred,
    enabled: provider.isEnabled(config),
    providerBrowseCount: providerCount,
    providerSample,
    providerError,
    probes,
    hint:
      providerCount > 0
        ? 'OK'
        : best
          ? 'raw parse OK but provider browse empty — cache/path bug'
          : probes.every((p) => p.error)
            ? 'شبکه/ریدایرکت: همه hostها fail — chain را ببین'
            : 'پاسخ آمد ولی item-movie نبود (لاگین/فیلتر)',
  }
}
