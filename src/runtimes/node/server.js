/**
 * Node runtime — Core + Stremio adapter + providers.
 * CinemaGraphy-next 0.6.2 — FA landing polish
 */
import cors from 'cors'
import express from 'express'
import { loadEnvFile } from './load-env.js'
import { configFromEnv, decodeUserConfig, encodeUserConfig, applyMode } from '../../core/config/app-config.js'
import { createLogger } from '../../core/logging/logger.js'
import { buildStremioManifest } from '../../clients/stremio/manifest.js'
import { registerProvider, listEnabledProviders, getProvider } from '../../providers/registry.js'
import { stubExampleProvider } from '../../providers/stub-example.js'
import { createF2MediaProvider } from '../../providers/f2media/index.js'
import { createCinamaticProvider } from '../../providers/cinamatic/index.js'
import { createAslMoviezProvider } from '../../providers/aslmoviez/index.js'
import { createAvaMovieProvider } from '../../providers/avamovie/index.js'
import { createDigiMovieProvider } from '../../providers/digimovie/index.js'
import { fromStremioProviderId, toStremioProviderId } from '../../core/ids/namespace.js'
import { setSessionCookie, getSessionCookie, hasSessionCookie } from './session-store.js'
import { bootNetwork } from './boot-net.js'

bootNetwork()
loadEnvFile('.env')

const log = createLogger(process.env.LOG_LEVEL || 'info')
const PORT = Number(process.env.PORT) || 7000
const VERSION = process.env.ADDON_VERSION || '0.6.2'

const FREE_PROVIDERS = ['f2media', 'cinamatic', 'aslmoviez']
const ALL_PROVIDER_KEYS = [...FREE_PROVIDERS, 'avamovie', 'digimovie']

registerProvider(stubExampleProvider)
registerProvider(createF2MediaProvider({ logger: log }))
registerProvider(createCinamaticProvider({ logger: log }))
registerProvider(createAslMoviezProvider({ logger: log }))
registerProvider(createAvaMovieProvider({ logger: log }))
registerProvider(createDigiMovieProvider({ logger: log }))

function deepMergeProviders(a = {}, b = {}) {
  const out = { ...a }
  for (const [k, v] of Object.entries(b || {})) out[k] = { ...(out[k] || {}), ...(v || {}) }
  return out
}

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
  if (!cfg.providers?.avamovie?.cookie) {
    const c = getSessionCookie('avamovie')
    if (c) cfg = { ...cfg, providers: deepMergeProviders(cfg.providers, { avamovie: { cookie: c, enabled: true } }) }
  }
  if (!cfg.providers?.digimovie?.cookie) {
    const c = getSessionCookie('digimovie')
    if (c) cfg = { ...cfg, providers: deepMergeProviders(cfg.providers, { digimovie: { cookie: c, enabled: true } }) }
  }
  return cfg
}

function buildPersonalConfig({ providersEnabled, avaCookie, digiCookie, avaBaseUrl, digiBaseUrl }) {
  const enabled = (providersEnabled || []).filter((k) => ALL_PROVIDER_KEYS.includes(k))
  const unique = [...new Set(enabled.length ? enabled : FREE_PROVIDERS)]
  const providers = {}
  const ava = String(avaCookie || '').trim()
  const digi = String(digiCookie || '').trim()
  const avaBase = String(avaBaseUrl || '').trim()
  const digiBase = String(digiBaseUrl || '').trim()
  if (unique.includes('avamovie')) {
    if (!ava) unique.splice(unique.indexOf('avamovie'), 1)
    else {
      providers.avamovie = { cookie: ava.slice(0, 4096), enabled: true }
      if (avaBase.startsWith('http')) providers.avamovie.baseUrl = avaBase.replace(/\/+$/, '').slice(0, 200)
    }
  }
  if (unique.includes('digimovie')) {
    if (!digi) unique.splice(unique.indexOf('digimovie'), 1)
    else {
      providers.digimovie = { cookie: digi.slice(0, 4096), enabled: true }
      if (digiBase.startsWith('http')) providers.digimovie.baseUrl = digiBase.replace(/\/+$/, '').slice(0, 200)
    }
  }
  return { providersEnabled: unique, providers: Object.keys(providers).length ? providers : undefined }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '\u0026amp;')
    .replace(/</g, '\u0026lt;')
    .replace(/>/g, '\u0026gt;')
    .replace(/"/g, '\u0026quot;')
}

function stripProto(u) {
  const s = String(u || '')
  if (s.startsWith('https://')) return s.slice(8)
  if (s.startsWith('http://')) return s.slice(7)
  return s
}

function landingHtml(opts = {}) {
  const {
    flash,
    personalPath = '',
    selected = FREE_PROVIDERS,
    cookieValue = '',
    digiCookieValue = '',
    avaBaseUrl = '',
    digiBaseUrl = '',
  } = opts
  const sel = (k) => (selected.includes(k) ? ' checked' : '')
  const flashBox = flash
    ? `<div class="flash ${flash.ok ? 'ok' : 'err'}">${escapeHtml(flash.msg)}</div>`
    : ''
  const install = personalPath
    ? `<div class="install">
        <a class="btn primary" href="stremio://${escapeHtml(stripProto(personalPath))}">نصب در استریمیو</a>
        <button type="button" class="btn ghost" onclick="navigator.clipboard.writeText(${JSON.stringify(personalPath)}).then(()=>this.textContent='کپی شد').catch(()=>{})">کپی لینک مانیفست</button>
        <p class="mono" dir="ltr">${escapeHtml(personalPath)}</p>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>CinemaGraphy Next ${VERSION}</title>
<style>
:root{
  --bg:#070b14; --card:#0f1624; --line:#1e2a3d; --text:#e8eef7; --muted:#8b9bb4;
  --accent:#7c3aed; --accent2:#2563eb; --ok:#10b981; --err:#ef4444; --chip:#182234;
}
*{box-sizing:border-box}
body{margin:0;font-family:Tahoma,Segoe UI,system-ui,sans-serif;background:radial-gradient(1200px 600px at 80% -10%,#1a1040 0%,var(--bg) 55%);color:var(--text);line-height:1.65;min-height:100vh}
.wrap{max-width:640px;margin:0 auto;padding:28px 16px 48px}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.logo{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,var(--accent),#4f46e5);display:grid;place-items:center;font-weight:800;font-size:1.1rem}
h1{margin:0;font-size:1.35rem;letter-spacing:-.02em}
.sub{margin:2px 0 0;color:var(--muted);font-size:.88rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px 18px;margin-bottom:14px;box-shadow:0 8px 30px rgba(0,0,0,.25)}
h2{margin:0 0 10px;font-size:1rem;color:#c4d0e4}
.hint{color:var(--muted);font-size:.82rem;margin:0 0 12px}
.row{display:flex;flex-wrap:wrap;gap:8px}
.chk{display:flex;align-items:center;gap:8px;background:var(--chip);border:1px solid var(--line);border-radius:999px;padding:8px 12px;font-size:.9rem;cursor:pointer;user-select:none}
.chk input{accent-color:var(--accent)}
.chk.premium{border-color:#3b2a6b}
label.field{display:block;margin:12px 0 4px;font-size:.86rem;color:#b7c5dc}
input[type=text],input[type=password]{width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--line);background:#0a101c;color:var(--text);font-size:.92rem}
input:focus{outline:2px solid #5b21b6;outline-offset:1px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:560px){.grid2{grid-template-columns:1fr}}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:11px 16px;border-radius:10px;border:0;font-weight:700;font-size:.92rem;cursor:pointer;text-decoration:none;color:#fff}
.btn.primary{background:linear-gradient(135deg,var(--accent),#5b21b6)}
.btn.blue{background:var(--accent2)}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--text)}
.btn.danger{background:#3f1d1d;border:1px solid #7f1d1d;color:#fecaca}
.flash{padding:11px 12px;border-radius:10px;margin-bottom:12px;font-size:.9rem}
.flash.ok{background:#0c2a22;border:1px solid #147a55;color:#a7f3d0}
.flash.err{background:#2a1212;border:1px solid #9b1c1c;color:#fecaca}
.install{margin:12px 0 4px;padding:14px;border-radius:12px;background:#14102a;border:1px solid #3b2a6b}
.install .mono{margin:10px 0 0;font-size:.75rem;color:var(--muted);word-break:break-all}
.foot{margin-top:18px;color:var(--muted);font-size:.8rem;text-align:center}
.foot a{color:#93c5fd}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#1e293b;color:#94a3b8;font-size:.75rem;margin-right:6px}
</style>
</head>
<body>
<div class="wrap">
  <div class="brand">
    <div class="logo">CG</div>
    <div>
      <h1>CinemaGraphy Next <span class="badge">v${VERSION}</span></h1>
      <p class="sub">افزونه استریمیو · منابع ایرانی رایگان و اشتراکی</p>
    </div>
  </div>

  ${flashBox}
  ${install}

  <form method="post" action="/configure">
    <div class="card">
      <h2>منابع رایگان</h2>
      <p class="hint">بدون کوکی کار می‌کنند. حداقل یکی را روشن بگذارید.</p>
      <div class="row">
        <label class="chk"><input type="checkbox" name="providers" value="f2media"${sel('f2media')}/> F2Media</label>
        <label class="chk"><input type="checkbox" name="providers" value="cinamatic"${sel('cinamatic')}/> Cinamatic</label>
        <label class="chk"><input type="checkbox" name="providers" value="aslmoviez"${sel('aslmoviez')}/> AslMoviez</label>
      </div>
    </div>

    <div class="card">
      <h2>منابع اشتراکی</h2>
      <p class="hint">برای Ava و Digi باید کوکی نشست (مثل PHPSESSID) را از مرورگر کپی کنید. baseUrl اختیاری است.</p>
      <div class="row" style="margin-bottom:8px">
        <label class="chk premium"><input type="checkbox" name="providers" value="avamovie"${sel('avamovie')}/> AvaMovie</label>
        <label class="chk premium"><input type="checkbox" name="providers" value="digimovie"${sel('digimovie')}/> DigiMovie</label>
      </div>
      <div class="grid2">
        <div>
          <label class="field">کوکی Ava</label>
          <input type="password" name="avaCookie" value="${escapeHtml(cookieValue)}" autocomplete="off" placeholder="PHPSESSID=..."/>
          <label class="field">Ava baseUrl</label>
          <input type="text" name="avaBaseUrl" value="${escapeHtml(avaBaseUrl)}" dir="ltr" placeholder="https://..."/>
        </div>
        <div>
          <label class="field">کوکی Digi</label>
          <input type="password" name="digiCookie" value="${escapeHtml(digiCookieValue)}" autocomplete="off" placeholder="PHPSESSID=..."/>
          <label class="field">Digi baseUrl</label>
          <input type="text" name="digiBaseUrl" value="${escapeHtml(digiBaseUrl)}" dir="ltr" placeholder="https://digimoviez53.top"/>
        </div>
      </div>
    </div>

    <div class="actions">
      <button type="submit" class="btn blue">ساخت مانیفست شخصی</button>
    </div>
  </form>

  <form method="post" action="/session/clear" style="margin-top:10px">
    <button type="submit" class="btn danger">پاک کردن نشست سرور</button>
  </form>

  <p class="foot">
    مانیفست عمومی (فقط رایگان‌ها اگر در env فعال باشند):
    <a href="/manifest.json" dir="ltr">/manifest.json</a>
    · <a href="/health" dir="ltr">/health</a>
  </p>
</div>
</body>
</html>`
}

function toMetas(items, providerKey) {
  return (items || []).map((it) => {
    const itemId = String(it.internalId || '').replace(new RegExp('^cg:' + providerKey + ':'), '')
    return {
      id: toStremioProviderId(providerKey, itemId),
      type: it.type,
      name: it.title,
      poster: it.poster,
      releaseInfo: it.year ? String(it.year) : undefined,
    }
  })
}

function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.urlencoded({ extended: true }))
  app.use(express.json({ limit: '64kb' }))

  app.get('/', (_req, res) => res.type('html').send(landingHtml()))
  app.get('/configure', (_req, res) => res.type('html').send(landingHtml()))

  app.post('/configure', (req, res) => {
    const body = req.body || {}
    let providers = body.providers
    if (!providers) providers = []
    if (!Array.isArray(providers)) providers = [providers]
    providers = providers.map(String).filter((k) => ALL_PROVIDER_KEYS.includes(k))
    const cookie = String(body.avaCookie || '').trim()
    const digiCookie = String(body.digiCookie || '').trim()
    const avaBase = String(body.avaBaseUrl || '').trim()
    const digiBase = String(body.digiBaseUrl || '').trim()

    if (!providers.length) providers = [...FREE_PROVIDERS]
    if (providers.includes('avamovie') && !cookie) {
      return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'آوا تیک خورده ولی کوکی خالی است' }, selected: providers, digiCookieValue: digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase }))
    }
    if (providers.includes('digimovie') && !digiCookie) {
      return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'دیجی تیک خورده ولی کوکی خالی است' }, selected: providers, cookieValue: cookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase }))
    }

    const cfg = buildPersonalConfig({ providersEnabled: providers, avaCookie: cookie, digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase })
    const token = encodeUserConfig(cfg)
    if (!token) return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'ساخت کانفیگ ناموفق بود' }, selected: providers }))

    if (cookie) setSessionCookie('avamovie', cookie)
    if (digiCookie) setSessionCookie('digimovie', digiCookie)

    const host = req.get('x-forwarded-host') || req.get('host') || ('localhost:' + PORT)
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim()
    const personalPath = proto + '://' + host + '/c/' + token + '/manifest.json'
    return res.type('html').send(landingHtml({
      flash: { ok: true, msg: 'مانیفست شخصی آماده است — نصب کن یا لینک را کپی کن' },
      personalPath,
      selected: cfg.providersEnabled,
      cookieValue: cookie,
      digiCookieValue: digiCookie,
      avaBaseUrl: avaBase,
      digiBaseUrl: digiBase,
    }))
  })

  app.post('/session/clear', (_req, res) => {
    setSessionCookie('avamovie', '')
    setSessionCookie('digimovie', '')
    res.type('html').send(landingHtml({ flash: { ok: true, msg: 'نشست سرور پاک شد' } }))
  })

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'cinemagraphy-next',
      version: VERSION,
      providers: listEnabledProviders(configFromEnv(process.env)).map((p) => p.key),
    })
  })

  function manifestHandler(req, res) {
    try {
      const cfg = resolveConfig(req)
      const providers = listEnabledProviders(cfg).map((p) => ({
        key: p.key,
        name: p.name,
        capabilities: p.capabilities,
      }))
      res.json(buildStremioManifest(cfg, providers))
    } catch (err) {
      log.error('manifest', err)
      res.status(500).json({ error: String(err.message || err) })
    }
  }

  async function catalogHandler(req, res) {
    try {
      const cfg = resolveConfig(req)
      const type = req.params.type
      let id = String(req.params.id || '')
      if (id.endsWith('.json')) id = id.slice(0, -5)
      const extraArgs = req.params.extraArgs || ''
      const extra = {}
      if (extraArgs) {
        const raw = extraArgs.endsWith('.json') ? extraArgs.slice(0, -5) : extraArgs
        for (const part of raw.split('&')) {
          const eq = part.indexOf('=')
          if (eq < 0) continue
          const k = decodeURIComponent(part.slice(0, eq))
          const v = decodeURIComponent(part.slice(eq + 1) || '')
          if (k) extra[k] = v
        }
      }
      const search = extra.search ? String(extra.search) : ''
      const genreRaw = extra.genre ? String(extra.genre) : ''
      const genre = genreRaw && !/^all$/i.test(genreRaw) ? genreRaw : ''
      const skip = extra.skip ? Number(extra.skip) : 0

      const typeCatalog = id.match(/^([a-z0-9]+)_(movies|series)$/i)
      if (typeCatalog) {
        const providerKey = typeCatalog[1].toLowerCase()
        const provider = getProvider(providerKey)
        if (!provider || (typeof provider.isEnabled === 'function' && !provider.isEnabled(cfg))) {
          return res.json({ metas: [] })
        }
        const wantType = type === 'series' ? 'series' : 'movie'
        let items = []
        if (search && provider.search) {
          items = await provider.search(search, { config: cfg, skip, timeoutMs: 18000 })
          items = (items || []).filter((it) => (it.type || wantType) === wantType)
        } else if (genre && provider.browseGenre) {
          items = await provider.browseGenre(wantType, genre, { config: cfg, skip, timeoutMs: 18000 })
        } else if (provider.browseType) {
          items = await provider.browseType(wantType, { config: cfg, skip, timeoutMs: 18000 })
        }
        return res.json({ metas: toMetas(items, providerKey) })
      }

      let providerKey = null
      for (const k of ['cinamatic', 'aslmoviez', 'avamovie', 'digimovie', 'f2media']) {
        if (id.startsWith(k + '_')) {
          providerKey = k
          break
        }
      }
      if (providerKey) {
        const provider = getProvider(providerKey)
        if (!provider || (typeof provider.isEnabled === 'function' && !provider.isEnabled(cfg))) {
          return res.json({ metas: [] })
        }
        let items = []
        const wantType = type === 'series' ? 'series' : 'movie'
        if (search && provider.search) {
          items = await provider.search(search, { config: cfg, skip, timeoutMs: 22000 })
          items = (items || []).filter((it) => (it.type || wantType) === wantType)
        } else if (genre && provider.browseGenre) {
          items = await provider.browseGenre(wantType, genre, {
            config: cfg,
            skip,
            timeoutMs: 22000,
          })
        } else if (provider.browse) {
          items = await provider.browse(id, { config: cfg, skip, timeoutMs: 22000 })
        } else if (provider.browseType) {
          items = await provider.browseType(wantType, {
            config: cfg,
            skip,
            timeoutMs: 22000,
          })
        }
        return res.json({ metas: toMetas(items, providerKey) })
      }
      res.json({ metas: [] })
    } catch (err) {
      log.error('catalog', err)
      res.json({ metas: [] })
    }
  }

  async function metaHandler(req, res) {
    try {
      const cfg = resolveConfig(req)
      let id = String(req.params.id || '')
      if (id.endsWith('.json')) id = id.slice(0, -5)
      const parsed = fromStremioProviderId(id)
      if (!parsed) return res.json({ meta: null })
      const provider = getProvider(parsed.providerKey)
      if (!provider || !provider.getDetail || (typeof provider.isEnabled === 'function' && !provider.isEnabled(cfg))) {
        return res.json({ meta: null })
      }
      const detail = await provider.getDetail(parsed.itemId, req.params.type, { config: cfg })
      if (!detail) return res.json({ meta: null })
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
      }
      if (detail.type === 'series' && detail.videos && detail.videos.length) {
        meta.videos = detail.videos.map((v) => ({
          id: metaId + ':' + v.season + ':' + v.episode,
          title: v.title || ('S' + v.season + 'E' + v.episode),
          season: v.season,
          episode: v.episode,
        }))
      }
      res.json({ meta })
    } catch (err) {
      log.error('meta', err)
      res.json({ meta: null })
    }
  }

  async function streamHandler(req, res) {
    try {
      const cfg = resolveConfig(req)
      let id = String(req.params.id || '')
      if (id.endsWith('.json')) id = id.slice(0, -5)
      const parsed = fromStremioProviderId(id)
      if (!parsed) return res.json({ streams: [] })
      const provider = getProvider(parsed.providerKey)
      if (!provider || !provider.getDetail || (typeof provider.isEnabled === 'function' && !provider.isEnabled(cfg))) {
        return res.json({ streams: [] })
      }
      const detail = await provider.getDetail(parsed.itemId, req.params.type, { config: cfg })
      if (!detail) return res.json({ streams: [] })
      const streams = await provider.getStreams(detail, {
        season: parsed.season,
        episode: parsed.episode,
      })
      res.json({
        streams: (streams || []).map((s) => ({
          name: s.name || s.quality || 'HD',
          title: s.title,
          url: s.url,
        })),
      })
    } catch (err) {
      log.error('stream', err)
      res.json({ streams: [] })
    }
  }

  for (const prefix of ['', '/c/:config']) {
    app.get(prefix + '/manifest.json', manifestHandler)
    app.get(prefix + '/catalog/:type/:id/:extraArgs.json', catalogHandler)
    app.get(prefix + '/catalog/:type/:id/:extraArgs', catalogHandler)
    app.get(prefix + '/catalog/:type/:id.json', catalogHandler)
    app.get(prefix + '/catalog/:type/:id', catalogHandler)
    app.get(prefix + '/meta/:type/:id.json', metaHandler)
    app.get(prefix + '/stream/:type/:id.json', streamHandler)
  }

  return app
}

const app = createApp()
app.listen(PORT, () => log.info('cinemagraphy-next listening', { port: PORT, version: VERSION }))
export { createApp, resolveConfig }
