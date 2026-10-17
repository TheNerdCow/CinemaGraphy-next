/**
 * Node runtime — Core + Stremio adapter + providers.
 */

import cors from 'cors'
import express from 'express'
import { loadEnvFile } from './load-env.js'
import {
  configFromEnv,
  decodeUserConfig,
  applyMode,
} from '../../core/config/app-config.js'
import { createLogger } from '../../core/logging/logger.js'
import { buildStremioManifest } from '../../clients/stremio/manifest.js'
import { registerProvider, listEnabledProviders, getProvider } from '../../providers/registry.js'
import { stubExampleProvider } from '../../providers/stub-example.js'
import { createF2MediaProvider } from '../../providers/f2media/index.js'
import { createCinamaticProvider } from '../../providers/cinamatic/index.js'
import { createAslMoviezProvider } from '../../providers/aslmoviez/index.js'
import { createAvaMovieProvider } from '../../providers/avamovie/index.js'
import { fromStremioProviderId, toStremioProviderId } from '../../core/ids/namespace.js'
import { createHttpClient } from '../../core/http/client.js'
import { parseListingHtml as parseF2Listing } from '../../providers/f2media/parse-listing.js'
import { parseListingHtml as parseAvaListing } from '../../providers/avamovie/parse.js'
import {
  setSessionCookie,
  getSessionCookie,
  hasSessionCookie,
} from './session-store.js'

loadEnvFile('.env')

const log = createLogger(process.env.LOG_LEVEL || 'info')
const PORT = Number(process.env.PORT) || 7000
const VERSION = process.env.ADDON_VERSION || '0.4.7'

registerProvider(stubExampleProvider)
registerProvider(createF2MediaProvider({ logger: log }))
registerProvider(createCinamaticProvider({ logger: log }))
registerProvider(createAslMoviezProvider({ logger: log }))
registerProvider(createAvaMovieProvider({ logger: log }))

function resolveConfig(req) {
  const server = configFromEnv(process.env)
  const token = req.params?.config || req.query?.config
  const overlay = token ? decodeUserConfig(token) : null

  let cfg = server
  if (overlay) {
    cfg = applyMode({
      ...server,
      ...overlay,
      resources: { ...server.resources, ...(overlay.resources || {}) },
      meta: { ...server.meta, ...(overlay.meta || {}) },
      ui: { ...server.ui, ...(overlay.ui || {}) },
      providers: deepMergeProviders(server.providers, overlay.providers),
      providersEnabled: overlay.providersEnabled?.length
        ? overlay.providersEnabled
        : server.providersEnabled,
    })
  }

  const sessionAva = getSessionCookie('avamovie')
  if (sessionAva) {
    cfg = {
      ...cfg,
      providers: deepMergeProviders(cfg.providers, {
        avamovie: { cookie: sessionAva, enabled: true },
      }),
    }
  }
  return cfg
}

function deepMergeProviders(a = {}, b = {}) {
  const out = { ...a }
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = { ...(out[k] || {}), ...(v || {}) }
  }
  return out
}

function parseExtra(raw) {
  if (!raw) return {}
  try {
    const s = String(raw).replace(/\.json$/i, '')
    return Object.fromEntries(new URLSearchParams(s))
  } catch {
    return {}
  }
}

function isAllGenres(genre) {
  const g = String(genre || '').trim().toLowerCase()
  if (!g) return true
  return /^(all(\s*genres)?|همه(\s*ژانر(ها)?)?|none|any)$/i.test(g)
}

function landingHtml(flash) {
  const hasAva = hasSessionCookie('avamovie') || Boolean(process.env.AVAMOVIE_COOKIE)
  const flashHtml = flash
    ? `<div class="flash ${flash.ok ? 'ok' : 'warn'}">${escapeHtml(flash.msg)}</div>`
    : ''
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>CinemaGraphy Next</title>
<style>
:root{--bg:#0b0d12;--card:#12161f;--line:#243044;--txt:#e8eaef;--mut:#9aa3b5;--acc:#6ea8ff;--ok:#3ddc97;--warn:#f5a524}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,Tahoma,sans-serif;background:var(--bg);color:var(--txt);padding:1.25rem}
.wrap{max-width:42rem;margin:0 auto}h1{font-size:1.35rem;margin:0 0 .35rem}.sub{color:var(--mut);font-size:.9rem;margin:0 0 1rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1.1rem 1.2rem;margin-bottom:1rem}
.card h2{font-size:1rem;margin:0 0 .75rem}a{color:var(--acc)}
label{display:block;font-size:.85rem;color:var(--mut);margin-bottom:.35rem}
textarea{width:100%;min-height:7rem;background:#0e121a;border:1px solid var(--line);border-radius:10px;color:var(--txt);padding:.7rem;font:0.85rem/1.4 ui-monospace,Consolas,monospace}
.row{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem}
button,.btn{appearance:none;border:0;border-radius:10px;padding:.7rem 1.05rem;font-weight:700;cursor:pointer;font-size:.9rem;text-decoration:none;display:inline-flex;align-items:center}
.primary{background:var(--acc);color:#061018}.ghost{background:#1a2230;color:var(--txt);border:1px solid var(--line)}
.ok{color:var(--ok)}.warn{color:var(--warn)}.flash{margin:.5rem 0 .75rem;font-size:.9rem;font-weight:600}
ul{margin:.4rem 0 0;padding-right:1.1rem;color:var(--mut);font-size:.88rem}
code{background:#1a2230;padding:.1rem .35rem;border-radius:4px;font-size:.82rem}
.badge{display:inline-block;padding:.15rem .5rem;border-radius:999px;font-size:.75rem;margin-right:.35rem}
.badge.on{background:#143528;color:var(--ok)}.badge.off{background:#2a1e12;color:var(--warn)}
.install{word-break:break-all;font-size:.85rem;background:#0e121a;border:1px solid var(--line);border-radius:10px;padding:.75rem;margin-top:.5rem}
</style>
</head>
<body>
<div class="wrap">
  <h1>سینماگرافی Next <span style="opacity:.55;font-size:.85rem">${VERSION}</span></h1>
  <p class="sub">F2Media · Cinamatic · AslMoviez · AvaMovie</p>

  <div class="card">
    <h2>نصب افزونه</h2>
    <p class="sub" style="margin:0">لینک نصب ثابت است. کوکی آوا فقط روی سرور ذخیره می‌شود.</p>
    <div class="install" id="installUrl"></div>
    <div class="row">
      <a class="btn primary" id="btnInstall" href="/manifest.json">باز کردن manifest</a>
      <button type="button" class="ghost" id="btnCopy">کپی لینک نصب</button>
    </div>
    <ul>
      <li><a href="/health">/health</a></li>
      <li><a href="/debug/avamovie">/debug/avamovie</a> (جزئیات خام)</li>
      <li><a href="/catalog/movie/avamovie_movies.json">کاتالوگ فیلم آوا</a></li>
    </ul>
  </div>

  <div class="card">
    <h2>کوکی آوا مووی <span class="badge ${hasAva ? 'on' : 'off'}">${hasAva ? 'فعال' : 'غیرفعال'}</span></h2>
    ${flashHtml}
    <p class="sub" style="margin-top:0">از مرورگر لاگین‌شده در <code>avadel.top</code> مقدار Cookie را کپی کن.</p>
    <form method="POST" action="/api/avamovie-cookie" id="avaForm">
      <label for="cookie">Cookie</label>
      <textarea id="cookie" name="cookie" placeholder="PHPSESSID=...; wordpress_logged_in_...=..." required></textarea>
      <div class="row">
        <button type="submit" class="primary" name="action" value="save">ذخیره کوکی</button>
        <button type="submit" class="ghost" name="action" value="clear" formnovalidate>پاک کردن</button>
        <button type="submit" class="ghost" name="action" value="test">ذخیره و تست</button>
      </div>
    </form>
  </div>
</div>
<script>
(function(){
  var origin = location.origin;
  var man = origin + '/manifest.json';
  var el = document.getElementById('installUrl');
  if (el) el.textContent = man;
  var a = document.getElementById('btnInstall');
  if (a) a.href = man;
  var btn = document.getElementById('btnCopy');
  if (btn) btn.addEventListener('click', function(){
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(man).then(function(){ btn.textContent = 'کپی شد'; setTimeout(function(){ btn.textContent = 'کپی لینک نصب'; }, 1500); });
    } else {
      prompt('لینک نصب را کپی کن:', man);
    }
  });
})();
</script>
</body>
</html>`
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
}

function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '64kb' }))
  app.use(express.urlencoded({ extended: false, limit: '64kb' }))

  const sendManifest = (req, res) => {
    const config = resolveConfig(req)
    const providers = listEnabledProviders(config).map((p) => ({
      key: p.key,
      name: p.name,
      capabilities: p.capabilities,
    }))
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.json(buildStremioManifest(config, providers))
  }

  app.get('/', (_req, res) => {
    res.type('html').send(landingHtml())
  })

  app.post('/api/avamovie-cookie', async (req, res) => {
    const action = String(req.body?.action || 'save')
    const cookie = String(req.body?.cookie || '')

    if (action === 'clear') {
      setSessionCookie('avamovie', '')
      res.type('html').send(landingHtml({ ok: true, msg: 'کوکی پاک شد.' }))
      return
    }

    if (!cookie.trim()) {
      res.type('html').send(landingHtml({ ok: false, msg: 'کوکی خالی است.' }))
      return
    }

    const saved = setSessionCookie('avamovie', cookie)
    if (!saved.ok) {
      res.type('html').send(landingHtml({ ok: false, msg: saved.error || 'خطا' }))
      return
    }

    if (action === 'test') {
      const config = resolveConfig(req)
      const provider = getProvider('avamovie')
      try {
        const items = await provider.browse('avamovie_movies', {
          config,
          skip: 0,
          timeoutMs: 25_000,
        })
        const n = items?.length || 0
        res.type('html').send(
          landingHtml({
            ok: n > 0,
            msg:
              n > 0
                ? `کوکی ذخیره شد — ${n} آیتم در کاتالوگ فیلم`
                : 'کوکی ذخیره شد ولی کاتالوگ خالی است — /debug/avamovie را ببین',
          }),
        )
      } catch (err) {
        res
          .type('html')
          .send(landingHtml({ ok: false, msg: 'ذخیره شد ولی تست خطا داد: ' + err.message }))
      }
      return
    }

    res.type('html').send(
      landingHtml({
        ok: true,
        msg: `کوکی ذخیره شد (${saved.len} کاراکتر).`,
      }),
    )
  })

  app.post('/api/avamovie-cookie.json', (req, res) => {
    const action = String(req.body?.action || 'save')
    if (action === 'clear') {
      setSessionCookie('avamovie', '')
      return res.json({ ok: true, cleared: true })
    }
    const cookie = String(req.body?.cookie || '')
    res.json(setSessionCookie('avamovie', cookie))
  })

  app.get('/health', (req, res) => {
    const config = resolveConfig(req)
    const ava = config.providers?.avamovie
    res.json({
      ok: true,
      service: 'cinemagraphy-next',
      version: VERSION,
      providers: listEnabledProviders(config).map((p) => p.key),
      avamovieCookie: Boolean(ava?.cookie),
      avamovieSession: hasSessionCookie('avamovie'),
      avamovieBase:
        ava?.baseUrl || process.env.AVAMOVIE_BASEURL || 'https://avadel.top',
      time: new Date().toISOString(),
    })
  })

  app.get('/debug/f2', async (_req, res) => {
    const base =
      (process.env.F2MEDIA_BASEURL || 'https://www.myf2ms.top').replace(/\/+$/, '')
    const url = `${base}/movies/`
    const http = createHttpClient({ timeoutMs: 18_000 })
    try {
      const r = await http.get(url)
      const text = r.ok ? await r.text() : ''
      const parsed = text ? parseF2Listing(text, base) : []
      res.json({
        ok: r.ok,
        status: r.status,
        base,
        url,
        htmlLen: text.length,
        parsed: parsed.length,
        sample: parsed.slice(0, 5).map((p) => ({ title: p.title, path: p.pagePath })),
        version: VERSION,
      })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, base, url, version: VERSION })
    }
  })

  /** Deep raw diagnostics — shows what each host returns */
  async function debugAva(req, res) {
    const config = resolveConfig(req)
    const provider = getProvider('avamovie')
    const cookie =
      config.providers?.avamovie?.cookie || process.env.AVAMOVIE_COOKIE || ''
    const preferred =
      config.providers?.avamovie?.baseUrl ||
      process.env.AVAMOVIE_BASEURL ||
      'https://avadel.top'

    if (!cookie) {
      res.json({
        ok: false,
        error: 'no cookie — use landing form or AVAMOVIE_COOKIE',
        version: VERSION,
      })
      return
    }

    const hosts = [
      preferred.replace(/\/+$/, ''),
      'https://avadel.top',
      'https://avamovie.shop',
    ].filter((v, i, a) => a.indexOf(v) === i)

    const probes = []
    for (const base of hosts) {
      const url = `${base}/movies/`
      const started = Date.now()
      try {
        const ac = new AbortController()
        const t = setTimeout(() => ac.abort(), 25_000)
        const r = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          signal: ac.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
            Cookie: cookie,
            Referer: `${base}/`,
          },
        })
        clearTimeout(t)
        const html = await r.text()
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
          error: err.name === 'AbortError' ? 'timeout' : err.message,
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

    const best = probes.find((p) => p.parsed > 0) || probes[0]
    res.json({
      ok: providerCount > 0 || Boolean(best?.parsed),
      version: VERSION,
      cookiePresent: true,
      cookieLen: cookie.length,
      preferredBase: preferred,
      enabled: provider.isEnabled(config),
      providerBrowseCount: providerCount,
      providerSample,
      providerError,
      probes,
      hint:
        providerCount === 0
          ? 'اگر همه probes.error دارند → شبکه/فیلتر. اگر itemMovie=0 و hasLoginForm → کوکی نامعتبر. اگر itemMovie>0 و parsed=0 → باگ پارسر.'
          : 'OK',
    })
  }

  app.get('/debug/avamovie', debugAva)
  app.get('/c/:config/debug/avamovie', debugAva)

  app.get('/manifest.json', sendManifest)
  app.get('/c/:config/manifest.json', sendManifest)

  async function catalogHandler(req, res) {
    const config = resolveConfig(req)
    const type = req.params.type
    let id = String(req.params.id || '').replace(/\.json$/i, '')
    const extraRaw =
      req.params.extraArgs ||
      (req.url.includes('/search=') ||
      req.url.includes('/skip=') ||
      req.url.includes('/genre=')
        ? req.url.split('/').pop()
        : '')
    const extra = parseExtra(extraRaw)
    const search = extra.search ? String(extra.search) : ''
    const genreRaw = extra.genre ? String(extra.genre) : ''
    const genre = isAllGenres(genreRaw) ? '' : genreRaw
    const skip = extra.skip ? Number(extra.skip) : 0

    log.info('catalog request', {
      type,
      id,
      search: search || undefined,
      genre: genre || undefined,
      skip,
    })

    const typeCatalog = id.match(/^([a-z0-9]+)_(movies|series)$/i)
    if (typeCatalog) {
      const providerKey = typeCatalog[1].toLowerCase()
      const provider = getProvider(providerKey)
      if (!provider || !provider.isEnabled(config)) {
        res.json({ metas: [] })
        return
      }
      const wantType = type === 'series' ? 'series' : 'movie'
      try {
        let items = []
        if (search && provider.search) {
          items = await provider.search(search, { config, skip, timeoutMs: 18_000 })
        } else if (genre && provider.browseGenre) {
          items = await provider.browseGenre(wantType, genre, {
            config,
            skip,
            timeoutMs: 18_000,
          })
        } else if (provider.browseType) {
          items = await provider.browseType(wantType, {
            config,
            skip,
            timeoutMs: 18_000,
          })
        }
        if (
          !items.length &&
          !search &&
          !genre &&
          providerKey === 'f2media' &&
          provider.browse
        ) {
          const fallbackId =
            wantType === 'series' ? 'f2media_series_updated' : 'f2media_movies_updated'
          items = await provider.browse(fallbackId, { config, skip, timeoutMs: 18_000 })
        }
        res.json({ metas: toMetas(items, providerKey, wantType) })
      } catch (err) {
        log.warn('catalog type error', { message: err.message })
        res.json({ metas: [] })
      }
      return
    }

    if (
      id.startsWith('f2media_') ||
      id.startsWith('cinamatic_') ||
      id.startsWith('aslmoviez_') ||
      id.startsWith('avamovie_')
    ) {
      const providerKey = id.startsWith('cinamatic_')
        ? 'cinamatic'
        : id.startsWith('aslmoviez_')
          ? 'aslmoviez'
          : id.startsWith('avamovie_')
            ? 'avamovie'
            : 'f2media'
      const provider = getProvider(providerKey)
      if (!provider || !provider.isEnabled(config) || config.mode === 'streams') {
        res.json({ metas: [] })
        return
      }
      try {
        let items = []
        if (search && provider.search) {
          items = await provider.search(search, { config, skip, timeoutMs: 22_000 })
        } else if (genre && provider.browseGenre) {
          const wantType = type === 'series' ? 'series' : 'movie'
          items = await provider.browseGenre(wantType, genre, {
            config,
            skip,
            timeoutMs: 22_000,
          })
        } else if (provider.browse) {
          items = await provider.browse(id, { config, skip, timeoutMs: 22_000 })
        }
        res.json({ metas: toMetas(items, providerKey, type) })
      } catch (err) {
        log.warn('catalog browse error', { message: err.message })
        res.json({ metas: [] })
      }
      return
    }

    res.json({ metas: [] })
  }

  function toMetas(items, providerKey, wantType) {
    return (items || [])
      .filter(
        (it) =>
          !wantType ||
          it.type === wantType ||
          (wantType === 'movie' && it.type !== 'series'),
      )
      .map((it) => {
        const itemId = String(it.internalId || '').replace(
          new RegExp(`^cg:${providerKey}:`),
          '',
        )
        return {
          id: toStremioProviderId(providerKey, itemId),
          type: it.type,
          name: it.title,
          poster: it.poster,
          releaseInfo: it.year ? String(it.year) : undefined,
        }
      })
  }

  async function metaHandler(req, res) {
    const config = resolveConfig(req)
    const id = String(req.params.id || '').replace(/\.json$/i, '')
    const parsed = fromStremioProviderId(id)
    if (!parsed) {
      res.json({ meta: null })
      return
    }
    const provider = getProvider(parsed.providerKey)
    if (!provider?.getDetail || !provider.isEnabled(config)) {
      res.json({ meta: null })
      return
    }
    try {
      const detail = await provider.getDetail(parsed.itemId, req.params.type, { config })
      if (!detail) {
        res.json({ meta: null })
        return
      }
      const metaId = toStremioProviderId(parsed.providerKey, parsed.itemId)
      const meta = {
        id: metaId,
        type: detail.type || req.params.type,
        name: detail.title || id,
        poster: detail.poster,
        background: detail.background || detail.poster,
        description: detail.description,
        releaseInfo: detail.year ? String(detail.year) : undefined,
        genres: detail.genres,
        imdbRating: detail.imdbRating,
        runtime: detail.runtime,
      }
      if (detail.type === 'series' && detail.videos?.length) {
        meta.videos = detail.videos.map((v) => ({
          id: `${metaId}:${v.season}:${v.episode}`,
          title: v.title || `S${v.season}E${v.episode}`,
          season: v.season,
          episode: v.episode,
        }))
      }
      res.json({ meta })
    } catch (err) {
      log.warn('meta error', { message: err.message })
      res.json({ meta: null })
    }
  }

  async function streamHandler(req, res) {
    const config = resolveConfig(req)
    const id = String(req.params.id || '').replace(/\.json$/i, '')
    const parsed = fromStremioProviderId(id)
    if (!parsed) {
      res.json({ streams: [] })
      return
    }
    const provider = getProvider(parsed.providerKey)
    if (!provider?.getDetail || !provider.isEnabled(config)) {
      res.json({ streams: [] })
      return
    }
    try {
      const detail = await provider.getDetail(parsed.itemId, req.params.type, { config })
      if (!detail) {
        res.json({ streams: [] })
        return
      }
      const streams = await provider.getStreams(detail, {
        season: parsed.season,
        episode: parsed.episode,
      })
      log.info('stream response', { id, count: (streams || []).length })
      res.json({
        streams: (streams || []).map((s) => ({
          name: s.name || s.quality || 'HD',
          title: s.title,
          url: s.url,
        })),
      })
    } catch (err) {
      log.warn('stream error', { message: err.message })
      res.json({ streams: [] })
    }
  }

  app.get('/c/:config/catalog/:type/:id/:extraArgs.json', catalogHandler)
  app.get('/c/:config/catalog/:type/:id/:extraArgs', catalogHandler)
  app.get('/c/:config/catalog/:type/:id.json', catalogHandler)
  app.get('/c/:config/catalog/:type/:id', catalogHandler)
  app.get('/c/:config/meta/:type/:id.json', metaHandler)
  app.get('/c/:config/stream/:type/:id.json', streamHandler)

  app.get('/catalog/:type/:id/:extraArgs.json', catalogHandler)
  app.get('/catalog/:type/:id/:extraArgs', catalogHandler)
  app.get('/catalog/:type/:id.json', catalogHandler)
  app.get('/catalog/:type/:id', catalogHandler)
  app.get('/meta/:type/:id.json', metaHandler)
  app.get('/stream/:type/:id.json', streamHandler)

  return app
}

const app = createApp()
app.listen(PORT, () => {
  log.info('cinemagraphy-next listening', { port: PORT, version: VERSION })
})

export { createApp, resolveConfig }
