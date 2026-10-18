/**
 * Node runtime — Core + Stremio adapter + providers.
 * CinemaGraphy-next 0.6.1 alpha — polish: unified 🎬 labels, Cast/هنرمندان filter, personal config.
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
const VERSION = process.env.ADDON_VERSION || '0.6.1'

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

function landingHtml(opts = {}) {
  const {
    flash, personalPath = '', selected = FREE_PROVIDERS,
    cookieValue = '', digiCookieValue = '', avaBaseUrl = '', digiBaseUrl = '',
  } = opts
  const hasAva = Boolean(cookieValue) || hasSessionCookie('avamovie') || Boolean(process.env.AVAMOVIE_COOKIE)
  const hasDigi = Boolean(digiCookieValue) || hasSessionCookie('digimovie') || Boolean(process.env.DIGIMOVIE_COOKIE)
  const sel = (k) => (selected.includes(k) ? ' checked' : '')
  const flashBox = flash
    ? `<div style="padding:10px 12px;border-radius:8px;margin:12px 0;background:${flash.ok ? '#0f3d2e' : '#3d1515'};border:1px solid ${flash.ok ? '#1a7a55' : '#a33'}">${escapeHtml(flash.msg)}</div>`
    : ''
  const install = personalPath
    ? `<p style="margin-top:14px"><a href="stremio://${escapeHtml(personalPath.replace(/^https?:\/\/\/, ''))}" style="display:inline-block;padding:10px 16px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">نصب در استریمیو</a>
       <br><small style="opacity:.7">یا مانیفست: <code dir="ltr">${escapeHtml(personalPath)}</code></small></p>`
    : ''
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>سینماگرافی Next ${VERSION}</title>
<style>
body{font-family:Tahoma,system-ui,sans-serif;background:#0b0f19;color:#e8eef7;margin:0;padding:24px;line-height:1.6}
.card{max-width:560px;margin:0 auto;background:#121826;border:1px solid #243044;border-radius:14px;padding:22px 20px}
h1{margin:0 0 6px;font-size:1.35rem}
label{display:block;margin:10px 0 4px;font-size:.9rem;opacity:.9}
input[type=text],input[type=password]{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid #2a3a52;background:#0b0f19;color:#e8eef7}
.row{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0}
.chk{display:flex;align-items:center;gap:6px;margin:4px 8px 4px 0}
button{margin-top:14px;padding:10px 18px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:600;cursor:pointer}
button.secondary{background:#334155}
small,code{font-size:.8rem}
a{color:#93c5fd}
</style>
</head>
<body>
<div class="card">
<h1>سینماگرافی Next <span style="opacity:.55;font-size:.85rem">${VERSION}</span></h1>
<p style="opacity:.75;margin:0 0 12px">آزمایشی · F2 / Cinamatic / Asl رایگان · آوا و دیجی با کوکی</p>
${flashBox}
${install}
<form method="post" action="/configure">
  <div class="row">
    <label class="chk"><input type="checkbox" name="providers" value="f2media"${sel('f2media')}/> F2Media</label>
    <label class="chk"><input type="checkbox" name="providers" value="cinamatic"${sel('cinamatic')}/> Cinamatic</label>
    <label class="chk"><input type="checkbox" name="providers" value="aslmoviez"${sel('aslmoviez')}/> AslMoviez</label>
    <label class="chk"><input type="checkbox" name="providers" value="avamovie"${sel('avamovie')}/> AvaMovie</label>
    <label class="chk"><input type="checkbox" name="providers" value="digimovie"${sel('digimovie')}/> DigiMovie</label>
  </div>
  <label>کوکی آوا (PHPSESSID یا Cookie کامل)</label>
  <input type="password" name="avaCookie" value="${escapeHtml(cookieValue)}" placeholder="PHPSESSID=..." autocomplete="off"/>
  <label>Base URL آوا (اختیاری)</label>
  <input type="text" name="avaBaseUrl" value="${escapeHtml(avaBaseUrl)}" placeholder="https://avamovie.shop" dir="ltr"/>
  <label>کوکی دیجی</label>
  <input type="password" name="digiCookie" value="${escapeHtml(digiCookieValue)}" placeholder="PHPSESSID=..." autocomplete="off"/>
  <label>Base URL دیجی (اختیاری)</label>
  <input type="text" name="digiBaseUrl" value="${escapeHtml(digiBaseUrl)}" placeholder="https://digimoviez53.top" dir="ltr"/>
  <button type="submit">ساخت مانیفست شخصی</button>
</form>
<form method="post" action="/session/clear" style="margin-top:8px"><button type="submit" class="secondary">پاک کردن سشن سرور</button></form>
<p style="margin-top:16px;opacity:.65;font-size:.85rem">مانیفست عمومی (فقط فری): <a href="/manifest.json" dir="ltr">/manifest.json</a></p>
</div>
</body>
</html>`
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

    if (providers.includes('avamovie') || providers.includes('digimovie')) {
      if (!cookie && !digiCookie && !providers.some((p) => FREE_PROVIDERS.includes(p))) {
        return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'حداقل یک کوکی لازم است.' }, selected: providers }))
      }
    }
    if (!providers.length) {
      return res.type('html').send(landingHtml({
        flash: { ok: false, msg: 'حداقل یک پرووایدر انتخاب کنید.' },
        selected: FREE_PROVIDERS,
        cookieValue: cookie, digiCookieValue: digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase,
      }))
    }
    if (providers.includes('avamovie') && !cookie) {
      return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'آوا تیک خورده، کوکی خالی است.' }, selected: providers, digiCookieValue: digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase }))
    }
    if (providers.includes('digimovie') && !digiCookie) {
      return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'دیجی تیک خورده، کوکی خالی است.' }, selected: providers, cookieValue: cookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase }))
    }

    const cfg = buildPersonalConfig({ providersEnabled: providers, avaCookie: cookie, digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase })
    const token = encodeUserConfig(cfg)
    if (!token) return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'خطا در ساخت config' }, selected: providers }))

    if (cookie) setSessionCookie('avamovie', cookie)
    if (digiCookie) setSessionCookie('digimovie', digiCookie)

    const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${PORT}`
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim()
    const personalPath = `${proto}://${host}/c/${token}/manifest.json`
    return res.type('html').send(landingHtml({
      flash: { ok: true, msg: 'مانیفست شخصی ساخته شد.' },
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
    res.type('html').send(landingHtml({ flash: { ok: true, msg: 'سشن پاک شد.' } }))
  })

  app.get('/health', (_req, res) => {
    res.json({
      ok: true, service: 'cinemagraphy-next', version: VERSION,
      providers: listEnabledProviders(configFromEnv(process.env)).map((p) => p.key),
    })
  })

  async function manifestHandler(req, res) {
    try {
      const cfg = resolveConfig(req)
      const manifest = buildStremioManifest(cfg)
      res.json(manifest)
    } catch (err) {
      log.error('manifest', err)
      res.status(500).json({ error: String(err.message || err) })
    }
  }

  async function catalogHandler(req, res) {
    try {
      const cfg = resolveConfig(req)
      const type = req.params.type
      const id = String(req.params.id || '').replace(/\.json$/, '')
      const extraArgs = req.params.extraArgs || ''
      const providerKey = fromStremioProviderId(id) || id.split('.')[0]
      const provider = getProvider(providerKey)
      if (!provider?.catalog) return res.json({ metas: [] })
      const extra = {}
      if (extraArgs) {
        for (const part of String(extraArgs).replace(/\.json$/, '').split('&')) {
          const [k, v] = part.split('=')
          if (k) extra[decodeURIComponent(k)] = decodeURIComponent(v || '')
        }
      }
      const result = await provider.catalog({ type, id, extra, config: cfg })
      res.json(result || { metas: [] })
    } catch (err) {
      log.error('catalog', err)
      res.json({ metas: [] })
    }
  }

  async function metaHandler(req, res) {
    try {
      const cfg = resolveConfig(req)
      const type = req.params.type
      const id = String(req.params.id || '').replace(/\.json$/, '')
      const providerKey = fromStremioProviderId(id)
      const provider = providerKey ? getProvider(providerKey) : null
      if (!provider?.meta) return res.json({ meta: null })
      const result = await provider.meta({ type, id, config: cfg })
      res.json(result || { meta: null })
    } catch (err) {
      log.error('meta', err)
      res.json({ meta: null })
    }
  }

  async function streamHandler(req, res) {
    try {
      const cfg = resolveConfig(req)
      const type = req.params.type
      const id = String(req.params.id || '').replace(/\.json$/, '')
      const providerKey = fromStremioProviderId(id)
      const provider = providerKey ? getProvider(providerKey) : null
      if (!provider?.streams) return res.json({ streams: [] })
      const result = await provider.streams({ type, id, config: cfg })
      res.json(result || { streams: [] })
    } catch (err) {
      log.error('stream', err)
      res.json({ streams: [] })
    }
  }

  const prefixes = ['', '/c/:config']
  for (const prefix of prefixes) {
    app.get(`${prefix}/manifest.json`, manifestHandler)
    app.get(`${prefix}/catalog/:type/:id/:extraArgs.json`, catalogHandler)
    app.get(`${prefix}/catalog/:type/:id/:extraArgs`, catalogHandler)
    app.get(`${prefix}/catalog/:type/:id.json`, catalogHandler)
    app.get(`${prefix}/catalog/:type/:id`, catalogHandler)
    app.get(`${prefix}/meta/:type/:id.json`, metaHandler)
    app.get(`${prefix}/stream/:type/:id.json`, streamHandler)
  }

  return app
}

const app = createApp()
app.listen(PORT, () => log.info('cinemagraphy-next listening', { port: PORT, version: VERSION }))
export { createApp, resolveConfig }
