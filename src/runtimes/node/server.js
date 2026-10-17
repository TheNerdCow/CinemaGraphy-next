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
  encodeUserConfig,
  redactSecrets,
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
import { parseListingHtml } from '../../providers/f2media/parse-listing.js'

loadEnvFile('.env')

const log = createLogger(process.env.LOG_LEVEL || 'info')
const PORT = Number(process.env.PORT) || 7000
const VERSION = process.env.ADDON_VERSION || '0.4.5'

registerProvider(stubExampleProvider)
registerProvider(createF2MediaProvider({ logger: log }))
registerProvider(createCinamaticProvider({ logger: log }))
registerProvider(createAslMoviezProvider({ logger: log }))
registerProvider(createAvaMovieProvider({ logger: log }))

function resolveConfig(req) {
  const server = configFromEnv(process.env)
  const token = req.params?.config || req.query?.config
  const overlay = token ? decodeUserConfig(token) : null
  if (!overlay) return server
  return applyMode({
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

/** Nuvio/Stremio "All Genres" is not a real genre filter. */
function isAllGenres(genre) {
  const g = String(genre || '').trim().toLowerCase()
  if (!g) return true
  return /^(all(\s*genres)?|همه(\s*ژانر(ها)?)?|none|any)$/i.test(g)
}

function landingHtml() {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>CinemaGraphy Next</title>
<style>
  :root { --bg:#0b0d12; --card:#12161f; --line:#243044; --txt:#e8eaef; --mut:#9aa3b5; --acc:#6ea8ff; --ok:#3ddc97; --warn:#f5a524; }
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Tahoma,sans-serif;background:var(--bg);color:var(--txt);padding:1.25rem}
  .wrap{max-width:42rem;margin:0 auto}
  h1{font-size:1.35rem;margin:0 0 .35rem}
  .sub{color:var(--mut);font-size:.9rem;margin-bottom:1.25rem}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1.1rem 1.2rem;margin-bottom:1rem}
  .card h2{font-size:1rem;margin:0 0 .75rem}
  a{color:var(--acc)}
  label{display:block;font-size:.85rem;color:var(--mut);margin-bottom:.35rem}
  textarea,input{width:100%;background:#0e121a;border:1px solid var(--line);border-radius:10px;color:var(--txt);padding:.7rem .8rem;font-size:.85rem;font-family:ui-monospace,Consolas,monospace}
  textarea{min-height:6.5rem;resize:vertical}
  .row{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.7rem}
  button,.btn{appearance:none;border:0;border-radius:10px;padding:.65rem 1rem;font-weight:600;cursor:pointer;font-size:.9rem;text-decoration:none;display:inline-flex;align-items:center}
  .primary{background:var(--acc);color:#061018}
  .ghost{background:#1a2230;color:var(--txt);border:1px solid var(--line)}
  .ok{color:var(--ok)} .warn{color:var(--warn)}
  #status{font-size:.85rem;margin-top:.6rem;min-height:1.2em}
  #out a{word-break:break-all}
  ul{margin:.4rem 0 0;padding-right:1.1rem;color:var(--mut);font-size:.88rem}
  code{background:#1a2230;padding:.1rem .35rem;border-radius:4px;font-size:.82rem}
</style>
</head>
<body>
<div class="wrap">
  <h1>سینماگرافی Next <span style="opacity:.6;font-size:.85rem">${VERSION}</span></h1>
  <p class="sub">F2Media · Cinamatic · AslMoviez · AvaMovie (اشتراکی)</p>

  <div class="card">
    <h2>لینک‌های پایه</h2>
    <ul>
      <li><a href="/manifest.json" id="mBase">/manifest.json</a></li>
      <li><a href="/health">/health</a></li>
      <li><a href="/debug/f2">/debug/f2</a></li>
      <li><a href="/debug/avamovie">/debug/avamovie</a> (با کوکی توکن یا env)</li>
    </ul>
  </div>

  <div class="card">
    <h2>دیباگ کوکی آوا مووی</h2>
    <p class="sub" style="margin-top:0">کوکی سشن لاگین‌شده‌ی <code>avadel.top</code> را اینجا بچسبان. فقط برای تست محلی — در توکن URL ذخیره می‌شود.</p>
    <label for="cookie">Cookie header</label>
    <textarea id="cookie" placeholder="wordpress_logged_in_…=…; …"></textarea>
    <div class="row">
      <button type="button" class="primary" id="btnSave">ذخیره و ساخت لینک</button>
      <button type="button" class="ghost" id="btnClear">پاک کردن</button>
      <button type="button" class="ghost" id="btnTest">تست کاتالوگ</button>
    </div>
    <div id="status"></div>
    <div id="out" style="margin-top:.75rem;font-size:.85rem"></div>
  </div>
</div>
<script>
(function () {
  const KEY = 'cg_next_avamovie_cookie';
  const ta = document.getElementById('cookie');
  const status = document.getElementById('status');
  const out = document.getElementById('out');
  try { ta.value = localStorage.getItem(KEY) || ''; } catch (_) {}

  function b64url(obj) {
    const json = JSON.stringify(obj);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function buildToken(cookie) {
    const c = String(cookie || '').trim();
    if (!c) return '';
    return b64url({
      providers: {
        avamovie: { cookie: c, enabled: true }
      }
    });
  }

  function origin() {
    return location.origin;
  }

  function setStatus(msg, cls) {
    status.className = cls || '';
    status.textContent = msg || '';
  }

  function renderLinks(token) {
    if (!token) {
      out.innerHTML = '';
      return;
    }
    const man = origin() + '/c/' + token + '/manifest.json';
    const cat = origin() + '/c/' + token + '/catalog/movie/avamovie_movies.json';
    const dbg = origin() + '/c/' + token + '/debug/avamovie';
    out.innerHTML =
      '<div><b>نصب Stremio/Nuvio:</b><br/><a href="' + man + '">' + man + '</a></div>' +
      '<div style="margin-top:.5rem"><b>کاتالوگ فیلم:</b><br/><a href="' + cat + '">' + cat + '</a></div>' +
      '<div style="margin-top:.5rem"><b>دیباگ:</b><br/><a href="' + dbg + '">' + dbg + '</a></div>';
  }

  document.getElementById('btnSave').onclick = function () {
    const cookie = ta.value.trim();
    if (!cookie) {
      setStatus('کوکی خالی است.', 'warn');
      return;
    }
    try { localStorage.setItem(KEY, cookie); } catch (_) {}
    const token = buildToken(cookie);
    if (!token) {
      setStatus('ساخت توکن ناموفق.', 'warn');
      return;
    }
    setStatus('ذخیره شد. لینک‌های زیر را در استریمیو/نوویو استفاده کن.', 'ok');
    renderLinks(token);
  };

  document.getElementById('btnClear').onclick = function () {
    ta.value = '';
    try { localStorage.removeItem(KEY); } catch (_) {}
    setStatus('پاک شد.', 'ok');
    out.innerHTML = '';
  };

  document.getElementById('btnTest').onclick = async function () {
    const cookie = ta.value.trim();
    if (!cookie) {
      setStatus('اول کوکی را بگذار.', 'warn');
      return;
    }
    const token = buildToken(cookie);
    setStatus('در حال تست…');
    try {
      const r = await fetch(origin() + '/c/' + token + '/catalog/movie/avamovie_movies.json');
      const j = await r.json();
      const n = (j.metas || []).length;
      setStatus(n ? ('موفق: ' + n + ' آیتم در کاتالوگ فیلم') : 'metas خالی — کوکی یا دامنه را چک کن', n ? 'ok' : 'warn');
      renderLinks(token);
    } catch (e) {
      setStatus('خطا: ' + (e && e.message ? e.message : e), 'warn');
    }
  };

  // auto-show if already saved
  if (ta.value.trim()) {
    renderLinks(buildToken(ta.value));
    setStatus('کوکی قبلی از localStorage بارگذاری شد.', 'ok');
  }
})();
</script>
</body>
</html>`
}

function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '64kb' }))

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

  app.get('/health', (req, res) => {
    const config = resolveConfig(req)
    const ava = config.providers?.avamovie
    res.json({
      ok: true,
      service: 'cinemagraphy-next',
      version: VERSION,
      providers: listEnabledProviders(config).map((p) => p.key),
      avamovieCookie: Boolean(ava?.cookie || process.env.AVAMOVIE_COOKIE),
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
      const parsed = text ? parseListingHtml(text, base) : []
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
      res.status(500).json({
        ok: false,
        error: err.message,
        base,
        url,
        version: VERSION,
      })
    }
  })

  async function debugAva(req, res) {
    const config = resolveConfig(req)
    const provider = getProvider('avamovie')
    const cookie = config.providers?.avamovie?.cookie || process.env.AVAMOVIE_COOKIE || ''
    const base =
      config.providers?.avamovie?.baseUrl ||
      process.env.AVAMOVIE_BASEURL ||
      'https://avadel.top'
    if (!cookie) {
      res.json({
        ok: false,
        error: 'no cookie — paste on landing or set AVAMOVIE_COOKIE',
        version: VERSION,
      })
      return
    }
    if (!provider) {
      res.json({ ok: false, error: 'provider missing', version: VERSION })
      return
    }
    try {
      const items = await provider.browse('avamovie_movies', {
        config,
        skip: 0,
        timeoutMs: 20_000,
      })
      res.json({
        ok: true,
        base,
        cookiePresent: true,
        cookieLen: String(cookie).length,
        count: items.length,
        sample: items.slice(0, 6).map((i) => ({
          title: i.title,
          type: i.type,
          year: i.year,
          hasPoster: Boolean(i.poster),
        })),
        enabled: provider.isEnabled(config),
        version: VERSION,
      })
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err.message,
        version: VERSION,
      })
    }
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
      req.params[0] ||
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
      genreRaw: genreRaw || undefined,
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
        log.warn('catalog type/search/genre error', { message: err.message })
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
          items = await provider.search(search, { config, skip, timeoutMs: 18_000 })
        } else if (genre && provider.browseGenre) {
          const wantType = type === 'series' ? 'series' : 'movie'
          items = await provider.browseGenre(wantType, genre, {
            config,
            skip,
            timeoutMs: 18_000,
          })
        } else if (provider.browse) {
          items = await provider.browse(id, { config, skip, timeoutMs: 18_000 })
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

  // Config-scoped Stremio routes
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

  app.get('/meta/:type/:id.json', metaHandler)
  app.get('/stream/:type/:id.json', streamHandler)

  return app
}

const app = createApp()
app.listen(PORT, () => {
  log.info('cinemagraphy-next listening', { port: PORT, version: VERSION })
})

export { createApp, resolveConfig }
