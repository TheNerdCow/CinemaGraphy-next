/**
 * Node runtime — Core + Stremio adapter + providers.
 * TEMP MINIMAL RESTORE — will expand
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
const VERSION = process.env.ADDON_VERSION || '0.6.0'

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
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function landingHtml(opts = {}) {
  const {
    flash, personalPath = '', selected = FREE_PROVIDERS,
    cookieValue = '', digiCookieValue = '', avaBaseUrl = '', digiBaseUrl = '',
  } = opts
  const hasAva = Boolean(cookieValue) || hasSessionCookie('avamovie') || Boolean(process.env.AVAMOVIE_COOKIE)
  const hasDigi = Boolean(digiCookieValue) || hasSessionCookie('digimovie') || Boolean(process.env.DIGIMOVIE_COOKIE)
  const flashHtml = flash ? `<div class="flash ${flash.ok ? 'ok' : 'warn'}">${escapeHtml(flash.msg)}</div>` : ''
  const labels = {
    f2media: 'F2Media (رایگان)', cinamatic: 'Cinamatic (رایگان)', aslmoviez: 'AslMoviez (رایگان)',
    avamovie: 'AvaMovie (اشتراکی)', digimovie: 'DigiMovie (اشتراکی)',
  }
  const checks = ALL_PROVIDER_KEYS.map((key) => {
    const on = selected.includes(key) ? 'checked' : ''
    return `<label class="chk"><input type="checkbox" name="providers" value="${key}" ${on}/> ${labels[key]}</label>`
  }).join('\n')
  const personalBlock = personalPath
    ? `<div class="install" id="personalUrl"></div><div class="row"><a class="btn primary" id="btnPersonal" href="${escapeHtml(personalPath)}">مانیفست شخصی</a><button type="button" class="ghost" id="btnCopyPersonal">کپی</button></div><p class="sub">لینک شخصی را عمومی نکن.</p>`
    : `<p class="sub">بعد از ذخیره، لینک اینجا ساخته می‌شود.</p>`
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>CinemaGraphy Next</title>
<style>:root{--bg:#0b0d12;--card:#12161f;--line:#243044;--txt:#e8eaef;--mut:#9aa3b5;--acc:#6ea8ff;--ok:#3ddc97;--warn:#f5a524}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,Tahoma,sans-serif;background:var(--bg);color:var(--txt);padding:1.25rem}
.wrap{max-width:44rem;margin:0 auto}h1{font-size:1.35rem;margin:0 0 .35rem}.sub{color:var(--mut);font-size:.9rem;margin:0 0 1rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1.1rem 1.2rem;margin-bottom:1rem}
.card h2{font-size:1rem;margin:0 0 .75rem}a{color:var(--acc)}label{display:block;font-size:.85rem;color:var(--mut);margin-bottom:.35rem}
.chk{display:flex;align-items:center;gap:.5rem;margin:.35rem 0;color:var(--txt);font-size:.9rem}
textarea,input[type=text],input:not([type=checkbox]){width:100%;background:#0e121a;border:1px solid var(--line);border-radius:10px;color:var(--txt);padding:.65rem;margin-bottom:.5rem;font:0.85rem ui-monospace,Consolas,monospace}
textarea{min-height:5rem}.row{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem}
button,.btn{appearance:none;border:0;border-radius:10px;padding:.7rem 1.05rem;font-weight:700;cursor:pointer;font-size:.9rem;text-decoration:none;display:inline-flex}
.primary{background:var(--acc);color:#061018}.ghost{background:#1a2230;color:var(--txt);border:1px solid var(--line)}
.ok{color:var(--ok)}.warn{color:var(--warn)}.flash{margin:.5rem 0;font-weight:600}
.badge{display:inline-block;padding:.15rem .5rem;border-radius:999px;font-size:.75rem}.badge.on{background:#143528;color:var(--ok)}.badge.off{background:#2a1e12;color:var(--warn)}
.install{word-break:break-all;font-size:.8rem;background:#0e121a;border:1px solid var(--line);border-radius:10px;padding:.75rem;margin-top:.5rem}</style></head><body><div class="wrap">
<h1>سینماگرافی Next <span style="opacity:.55;font-size:.85rem">${VERSION}</span></h1>
<p class="sub">شخصی‌سازی · کوکی و دامنه داخل لینک نصب</p>
<div class="card"><h2>۱) منابع</h2>
<form method="POST" action="/api/build-config">
${checks}
<h2 style="margin-top:1rem">۲) اشتراک و دامنه</h2>
<label>Ava base URL</label>
<input name="avaBase" value="${escapeHtml(avaBaseUrl)}" placeholder="https://avadel.top"/>
<label>کوکی آوا <span class="badge ${hasAva?'on':'off'}">${hasAva?'آماده':'اختیاری'}</span></label>
<textarea name="cookie" placeholder="PHPSESSID=...">${escapeHtml(cookieValue)}</textarea>
<label>Digi base URL</label>
<input name="digiBase" value="${escapeHtml(digiBaseUrl)}" placeholder="https://digimoviez53.top"/>
<label>کوکی دیجی <span class="badge ${hasDigi?'on':'off'}">${hasDigi?'آماده':'اختیاری'}</span></label>
<textarea name="digiCookie" placeholder="PHPSESSID=...">${escapeHtml(digiCookieValue)}</textarea>
${flashHtml}
<div class="row"><button class="primary" name="action" value="build">ساخت لینک شخصی</button>
<button class="ghost" name="action" value="test">ساخت و تست</button>
<button class="ghost" name="action" value="session">سشن لوکال</button></div>
</form></div>
<div class="card"><h2>لینک شخصی</h2>${personalBlock}</div>
<div class="card"><h2>عمومی</h2><div class="install" id="publicUrl"></div>
<div class="row"><a class="btn ghost" href="/manifest.json">manifest</a><a class="btn ghost" href="/health">health</a></div></div>
</div><script>
(function(){var o=location.origin,p=o+'/manifest.json';var el=document.getElementById('publicUrl');if(el)el.textContent=p;
var pp=${JSON.stringify(personalPath||'')};if(pp){var f=o+pp;var pe=document.getElementById('personalUrl');if(pe)pe.textContent=f;var pa=document.getElementById('btnPersonal');if(pa)pa.href=f;var b=document.getElementById('btnCopyPersonal');if(b)b.onclick=function(){navigator.clipboard&&navigator.clipboard.writeText(f);};}
})();
</script></body></html>`
}

function parseExtra(raw) {
  if (!raw) return {}
  try { return Object.fromEntries(new URLSearchParams(String(raw).replace(/\.json$/i, ''))) } catch { return {} }
}
function isAllGenres(genre) {
  const g = String(genre || '').trim().toLowerCase()
  if (!g) return true
  return /^(all(\s*genres)?|همه|none|any)/i.test(g)
}

function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '64kb' }))
  app.use(express.urlencoded({ extended: true, limit: '64kb' }))

  const sendManifest = (req, res) => {
    const config = resolveConfig(req)
    const providers = listEnabledProviders(config).map((p) => ({ key: p.key, name: p.name, capabilities: p.capabilities }))
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.json(buildStremioManifest(config, providers))
  }

  app.get('/', (_req, res) => res.type('html').send(landingHtml()))
  app.get('/configure', (_req, res) => res.type('html').send(landingHtml()))

  app.post('/api/build-config', async (req, res) => {
    const action = String(req.body?.action || 'build')
    let providers = req.body?.providers
    if (!providers) providers = []
    if (!Array.isArray(providers)) providers = [providers]
    providers = providers.map(String).filter((k) => ALL_PROVIDER_KEYS.includes(k))
    if (!providers.length) providers = [...FREE_PROVIDERS]
    const cookie = String(req.body?.cookie || '').trim()
    const digiCookie = String(req.body?.digiCookie || '').trim()
    const avaBase = String(req.body?.avaBase || '').trim()
    const digiBase = String(req.body?.digiBase || '').trim()

    if (action === 'session') {
      if (!cookie && !digiCookie) {
        return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'حداقل یک کوکی لازم است.' }, selected: providers }))
      }
      if (cookie) setSessionCookie('avamovie', cookie)
      if (digiCookie) setSessionCookie('digimovie', digiCookie)
      return res.type('html').send(landingHtml({
        flash: { ok: true, msg: 'سشن لوکال ذخیره شد' }, selected: providers,
        cookieValue: cookie, digiCookieValue: digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase,
      }))
    }

    if (providers.includes('avamovie') && !cookie) {
      return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'آوا تیک خورده، کوکی خالی است.' }, selected: providers, digiCookieValue: digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase }))
    }
    if (providers.includes('digimovie') && !digiCookie) {
      return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'دیجی تیک خورده، کوکی خالی است.' }, selected: providers, cookieValue: cookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase }))
    }

    const personal = buildPersonalConfig({ providersEnabled: providers, avaCookie: cookie, digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase })
    const token = encodeUserConfig(personal)
    if (!token) return res.type('html').send(landingHtml({ flash: { ok: false, msg: 'خطا در ساخت config' }, selected: providers }))
    const personalPath = `/c/${token}/manifest.json`

    if (action === 'test') {
      if (cookie) setSessionCookie('avamovie', cookie)
      if (digiCookie) setSessionCookie('digimovie', digiCookie)
      const config = resolveConfig({ params: { config: token } })
      const msgs = []
      try {
        if (cookie && personal.providersEnabled.includes('avamovie')) {
          const items = await getProvider('avamovie').browse('avamovie_movies', { config, skip: 0, timeoutMs: 25_000 })
          msgs.push(`آوا: ${items?.length || 0}`)
        }
        if (digiCookie && personal.providersEnabled.includes('digimovie')) {
          const items = await getProvider('digimovie').browse('digimovie_movies', { config, skip: 0, timeoutMs: 25_000 })
          msgs.push(`دیجی: ${items?.length || 0}`)
        }
        return res.type('html').send(landingHtml({
          flash: { ok: true, msg: msgs.length ? `آماده — ${msgs.join(' · ')}` : 'لینک ساخته شد' },
          personalPath, selected: personal.providersEnabled,
          cookieValue: cookie, digiCookieValue: digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase,
        }))
      } catch (err) {
        return res.type('html').send(landingHtml({
          flash: { ok: false, msg: 'تست: ' + err.message }, personalPath, selected: personal.providersEnabled,
          cookieValue: cookie, digiCookieValue: digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase,
        }))
      }
    }

    res.type('html').send(landingHtml({
      flash: { ok: true, msg: `لینک شخصی: ${personal.providersEnabled.join(', ')}` },
      personalPath, selected: personal.providersEnabled,
      cookieValue: cookie, digiCookieValue: digiCookie, avaBaseUrl: avaBase, digiBaseUrl: digiBase,
    }))
  })

  app.get('/health', (req, res) => {
    const config = resolveConfig(req)
    const ava = config.providers?.avamovie
    const digi = config.providers?.digimovie
    res.json({
      ok: true, service: 'cinemagraphy-next', version: VERSION,
      providers: listEnabledProviders(config).map((p) => p.key),
      avamovieCookie: Boolean(ava?.cookie), digimovieCookie: Boolean(digi?.cookie),
      avamovieBase: ava?.baseUrl || process.env.AVAMOVIE_BASEURL || 'https://avadel.top',
      digimovieBase: digi?.baseUrl || process.env.DIGIMOVIE_BASEURL || 'https://digimoviez53.top',
      time: new Date().toISOString(),
    })
  })

  app.get('/manifest.json', sendManifest)
  app.get('/c/:config/manifest.json', sendManifest)

  function toMetas(items, providerKey, wantType) {
    return (items || []).filter((it) => !wantType || it.type === wantType || (wantType === 'movie' && it.type !== 'series')).map((it) => {
      const itemId = String(it.internalId || '').replace(new RegExp(`^cg:${providerKey}:`), '')
      return { id: toStremioProviderId(providerKey, itemId), type: it.type, name: it.title, poster: it.poster, releaseInfo: it.year ? String(it.year) : undefined }
    })
  }

  async function catalogHandler(req, res) {
    const config = resolveConfig(req)
    const type = req.params.type
    let id = String(req.params.id || '').replace(/\.json$/i, '')
    const extra = parseExtra(req.params.extraArgs || '')
    const search = extra.search ? String(extra.search) : ''
    const genre = isAllGenres(extra.genre) ? '' : String(extra.genre || '')
    const skip = extra.skip ? Number(extra.skip) : 0

    const typeCatalog = id.match(/^([a-z0-9]+)_(movies|series)$/i)
    if (typeCatalog) {
      const providerKey = typeCatalog[1].toLowerCase()
      const provider = getProvider(providerKey)
      if (!provider || !provider.isEnabled(config)) return res.json({ metas: [] })
      const wantType = type === 'series' ? 'series' : 'movie'
      try {
        let items = []
        if (search && provider.search) items = await provider.search(search, { config, skip, timeoutMs: 18_000 })
        else if (genre && provider.browseGenre) items = await provider.browseGenre(wantType, genre, { config, skip, timeoutMs: 18_000 })
        else if (provider.browseType) items = await provider.browseType(wantType, { config, skip, timeoutMs: 18_000 })
        return res.json({ metas: toMetas(items, providerKey, wantType) })
      } catch { return res.json({ metas: [] }) }
    }

    if (/^(f2media_|cinamatic_|aslmoviez_|avamovie_|digimovie_)/.test(id)) {
      const providerKey = id.startsWith('cinamatic_') ? 'cinamatic' : id.startsWith('aslmoviez_') ? 'aslmoviez' : id.startsWith('avamovie_') ? 'avamovie' : id.startsWith('digimovie_') ? 'digimovie' : 'f2media'
      const provider = getProvider(providerKey)
      if (!provider || !provider.isEnabled(config) || config.mode === 'streams') return res.json({ metas: [] })
      try {
        let items = []
        if (search && provider.search) items = await provider.search(search, { config, skip, timeoutMs: 22_000 })
        else if (genre && provider.browseGenre) items = await provider.browseGenre(type === 'series' ? 'series' : 'movie', genre, { config, skip, timeoutMs: 22_000 })
        else if (provider.browse) items = await provider.browse(id, { config, skip, timeoutMs: 22_000 })
        return res.json({ metas: toMetas(items, providerKey, type) })
      } catch { return res.json({ metas: [] }) }
    }
    res.json({ metas: [] })
  }

  async function metaHandler(req, res) {
    const config = resolveConfig(req)
    const id = String(req.params.id || '').replace(/\.json$/i, '')
    const parsed = fromStremioProviderId(id)
    if (!parsed) return res.json({ meta: null })
    const provider = getProvider(parsed.providerKey)
    if (!provider?.getDetail || !provider.isEnabled(config)) return res.json({ meta: null })
    try {
      const detail = await provider.getDetail(parsed.itemId, req.params.type, { config })
      if (!detail) return res.json({ meta: null })
      const metaId = toStremioProviderId(parsed.providerKey, parsed.itemId)
      const meta = {
        id: metaId, type: detail.type || req.params.type, name: detail.title || id,
        poster: detail.poster, background: detail.background || detail.poster,
        description: detail.description, releaseInfo: detail.year ? String(detail.year) : undefined,
        genres: detail.genres, imdbRating: detail.imdbRating,
      }
      if (detail.type === 'series' && detail.videos?.length) {
        meta.videos = detail.videos.map((v) => ({ id: `${metaId}:${v.season}:${v.episode}`, title: v.title || `S${v.season}E${v.episode}`, season: v.season, episode: v.episode }))
      }
      res.json({ meta })
    } catch { res.json({ meta: null }) }
  }

  async function streamHandler(req, res) {
    const config = resolveConfig(req)
    const id = String(req.params.id || '').replace(/\.json$/i, '')
    const parsed = fromStremioProviderId(id)
    if (!parsed) return res.json({ streams: [] })
    const provider = getProvider(parsed.providerKey)
    if (!provider?.getDetail || !provider.isEnabled(config)) return res.json({ streams: [] })
    try {
      const detail = await provider.getDetail(parsed.itemId, req.params.type, { config })
      if (!detail) return res.json({ streams: [] })
      const streams = await provider.getStreams(detail, { season: parsed.season, episode: parsed.episode })
      res.json({ streams: (streams || []).map((s) => ({ name: s.name || s.quality || 'HD', title: s.title, url: s.url })) })
    } catch { res.json({ streams: [] }) }
  }

  for (const prefix of ['/c/:config', '']) {
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
