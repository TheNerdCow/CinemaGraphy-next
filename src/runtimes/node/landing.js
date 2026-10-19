/**
 * CinemaGraphy NEXT — Liquid Glass Modern RTL Landing Page
 */
import { ASSET_BG, ASSET_MARK, ASSET_FAV, ASSET_DIGI_FAV } from './landing-assets.js'

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function stripProto(u) {
  const s = String(u || '')
  if (s.startsWith('https://')) return s.slice(8)
  if (s.startsWith('http://')) return s.slice(7)
  return s
}

export function renderLanding(opts = {}) {
  const version = opts.version || '0.6.6'
  const free = opts.freeProviders || ['f2media', 'cinamatic', 'aslmoviez']
  const selected = opts.selected || free
  const isSel = (k) => selected.includes(k)
  const selAttr = (k) => (isSel(k) ? ' checked' : '')
  
  // بررسی وضعیت انتخاب کاتالوگ‌ها
  const catalogs = opts.catalogs || {}
  const catSel = (prov, cat) => {
    if (Object.keys(catalogs).length === 0) return ' checked' // دفعه اول همه روشن
    return (catalogs[prov] && catalogs[prov].includes(cat)) ? ' checked' : ''
  }

  const flash = opts.flash
  const personalPath = opts.personalPath || ''
  
  const cookieValue = opts.cookieValue || ''
  const digiCookieValue = opts.digiCookieValue || ''
  const avaBaseUrl = opts.avaBaseUrl || 'https://avadel.top'
  const digiBaseUrl = opts.digiBaseUrl || 'https://digimoviez53.top'
  
  const hostManifest = opts.hostManifest || '/manifest.json'
  const stremioPublicUrl = 'stremio://' + stripProto(hostManifest)

  const FAVICONS = {
    f2media: 'https://www.myf2ms.top/favicon.ico',
    cinamatic: 'https://cinamatic.top/wp-content/uploads/2026/06/cropped-46C79B8B-60E5-4483-8245-C8676952D972-32x32.png',
    aslmoviez: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://aslmoviez.com&size=64',
    avamovie: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://avadel.top&size=64',
    digimovie: ASSET_DIGI_FAV
  }

  const flashHtml = flash ? `<div class="flash ${flash.ok ? 'ok' : 'err'}" role="status"><span>${esc(flash.msg)}</span></div>` : ''

  const installResult = personalPath
    ? `<div class="liquid-card custom-result" style="border-color: rgba(16, 185, 129, 0.4); margin-bottom: 16px;">
        <div class="result-head">
          <span class="result-badge">آماده نصب</span>
          <span class="result-title">مانیفست شخصی شما ساخته شد</span>
        </div>
        <div class="result-url" dir="ltr">${esc(personalPath)}</div>
        <div class="btn-row" style="justify-content: flex-start; margin-top: 8px;">
          <a class="btn btn-gold" href="stremio://${esc(stripProto(personalPath))}">نصب در استریمیو</a>
          <a class="btn btn-glass" href="stremio://${esc(stripProto(personalPath))}">نصب در نوویو</a>
          <button type="button" class="btn btn-glass" data-copy="${esc(personalPath)}" data-label="کپی لینک">کپی لینک</button>
        </div>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>سینماگرافی NEXT | افزونه استریمیو و نوویو</title>
<link rel="icon" href="${ASSET_FAV}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
:root {
  --bg: #05070d;
  --gold: #f59e0b;
  --gold-glow: rgba(245, 158, 11, 0.3);
  --text: #f1f5f9;
  --muted: #94a3b8;
  --radius: 24px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { font-family: 'Vazirmatn', sans-serif; background-color: var(--bg); color: var(--text); min-height: 100vh; overflow-x: hidden; position: relative; line-height: 1.6; }

/* پس‌زمینه */
.bg-layer { position: fixed; inset: 0; background: url('${ASSET_BG}') center/cover no-repeat; filter: brightness(0.4) contrast(1.1); z-index: -2; }
.bg-overlay { position: fixed; inset: 0; background: radial-gradient(circle at 50% 20%, rgba(5,7,13,0.3) 0%, rgba(5,7,13,0.85) 75%, #05070d 100%); z-index: -1; }

.page-container { max-width: 900px; margin: 0 auto; padding: 32px 16px 48px; display: flex; flex-direction: column; gap: 24px; }

/* Liquid Glass */
.liquid-glass { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.08); border-top: 1px solid rgba(255, 255, 255, 0.15); border-left: 1px solid rgba(255, 255, 255, 0.15); border-radius: var(--radius); padding: 32px 24px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4); position: relative; overflow: hidden; }

/* هیرو */
.hero-section { text-align: center; border-color: rgba(245, 158, 11, 0.25); border-top-color: rgba(245, 158, 11, 0.4); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 20px rgba(245, 158, 11, 0.05); }

/* رفع بیرون‌زدگی لوگو با Transparent PNG */
.logo-badge-wrap { width: 96px; height: 96px; margin: 0 auto 16px; border-radius: 50%; background: #090d18; border: 2px solid rgba(245, 158, 11, 0.4); box-shadow: 0 0 30px var(--gold-glow); padding: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.logo-badge-wrap img { width: 100%; height: 100%; object-fit: contain; transform: scale(1.05); }

.version-tag { display: inline-block; font-size: 0.75rem; font-weight: 700; color: var(--gold); background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); padding: 3px 14px; border-radius: 999px; margin-bottom: 12px; direction: ltr; }
.hero-section h1 { font-size: clamp(1.8rem, 4.5vw, 2.5rem); font-weight: 900; margin-bottom: 4px; letter-spacing: -0.02em; }
.hero-section h1 span { background: linear-gradient(135deg, #fde047 0%, #f59e0b 50%, #ea580c 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hero-subtitle { font-size: 1rem; font-weight: 700; color: var(--gold); margin-bottom: 12px; }
.hero-desc { font-size: 0.9rem; color: var(--muted); max-width: 520px; margin: 0 auto 24px; }

/* دکمه‌ها */
.btn-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px; border-radius: 14px; font-family: inherit; font-size: 0.88rem; font-weight: 700; text-decoration: none; cursor: pointer; border: 1px solid transparent; transition: all 0.2s ease; }
.btn:hover { transform: translateY(-2px); }
.btn-gold { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #05070d; box-shadow: 0 6px 20px rgba(245, 158, 11, 0.35); }
.btn-glass { background: rgba(255, 255, 255, 0.05); color: var(--text); border-top: 1px solid rgba(255, 255, 255, 0.15); border-left: 1px solid rgba(255, 255, 255, 0.15); border-bottom: 1px solid rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); }
.btn-glass:hover { background: rgba(255, 255, 255, 0.1); border-top-color: rgba(245, 158, 11, 0.4); color: var(--gold); }
.btn.copied { background: rgba(16, 185, 129, 0.2) !important; color: #34d399 !important; border-color: rgba(16, 185, 129, 0.4) !important; }

/* سرتیترها */
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.section-title { display: flex; align-items: center; gap: 8px; font-size: 1.05rem; font-weight: 800; }
.section-title svg { width: 20px; height: 20px; color: var(--gold); }

/* وضعیت منابع */
.sources-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
.source-status-card { background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.src-info { display: flex; align-items: center; gap: 8px; direction: ltr; }
.src-favicon { width: 20px; height: 20px; border-radius: 6px; object-fit: contain; background: rgba(255,255,255,0.08); flex-shrink: 0; }
.src-name { font-size: 0.8rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.src-meta { display: flex; align-items: center; justify-content: space-between; font-size: 0.7rem; }
.status-pill { display: inline-flex; align-items: center; gap: 5px; font-weight: 700; color: var(--muted); }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); }
.status-pill.online { color: #34d399; }
.status-pill.online .status-dot { background: #10b981; box-shadow: 0 0 8px #10b981; }
.status-pill.offline { color: #f87171; }
.status-pill.offline .status-dot { background: #ef4444; }

/* فرم نصب و کاتالوگ‌ها */
.providers-select-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
.prov-checkbox-wrap { position: relative; cursor: pointer; user-select: none; }
.prov-checkbox-wrap input { position: absolute; opacity: 0; pointer-events: none; }
.prov-pill-box { display: flex; align-items: center; gap: 8px; padding: 12px 10px; border-radius: 12px; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.2s; }
.prov-pill-box span { font-size: 0.8rem; font-weight: 800; direction: ltr; }
.custom-tick { width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid var(--muted); margin-right: auto; display: grid; place-items: center; }
.custom-tick svg { width: 12px; height: 12px; opacity: 0; stroke: #05070d; }
.prov-checkbox-wrap input:checked + .prov-pill-box { background: rgba(245, 158, 11, 0.15); border-color: var(--gold); }
.prov-checkbox-wrap input:checked + .prov-pill-box .custom-tick { background: var(--gold); border-color: var(--gold); }
.prov-checkbox-wrap input:checked + .prov-pill-box .custom-tick svg { opacity: 1; }

.config-drawers { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
.config-drawer { display: none; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 14px; padding: 16px; }
.config-drawer.open { display: block; }
.drawer-header { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 800; color: var(--gold); margin-bottom: 12px; }

/* استایل چک‌باکس کاتالوگ‌ها */
.catalog-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.cat-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: 0.2s; }
.cat-chip input { display: none; }
.cat-chip:has(input:checked) { background: rgba(245, 158, 11, 0.15); border-color: var(--gold); color: #fde68a; }

.form-inputs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 0.78rem; font-weight: 700; color: var(--muted); }
.ltr-input { direction: ltr; text-align: left; width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.05); color: var(--text); font-family: monospace; font-size: 0.85rem; outline: none; }
.ltr-input:focus { border-color: var(--gold); background: rgba(0,0,0,0.4); }

.flash { padding: 12px 14px; border-radius: 12px; margin-bottom: 16px; font-size: 0.85rem; font-weight: 700; }
.flash.ok { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #6ee7b7; }
.flash.err { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; }

.custom-result { padding: 16px; border-radius: 14px; background: rgba(16, 185, 129, 0.1); }
.result-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.result-badge { background: #10b981; color: #fff; font-size: 0.7rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; }
.result-title { font-size: 0.9rem; font-weight: 800; }
.result-url { padding: 10px 12px; border-radius: 10px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255, 255, 255, 0.1); font-family: monospace; font-size: 0.8rem; color: #fde68a; word-break: break-all; margin-bottom: 12px; }

@media (max-width: 768px) { .form-inputs-grid { grid-template-columns: 1fr; } .sources-grid, .providers-select-grid { grid-template-columns: repeat(2, 1fr); } .liquid-glass { padding: 24px 16px; } }
</style>
</head>
<body>
<div class="bg-layer"></div>
<div class="bg-overlay"></div>

<main class="page-container">
  <!-- هیرو -->
  <section class="liquid-glass hero-section">
    <div class="logo-badge-wrap"><img src="${ASSET_MARK}" alt="CinemaGraphy NEXT"/></div>
    <span class="version-tag">v${esc(version)}</span>
    <h1>سینماگرافی <span>NEXT</span></h1>
    <div class="hero-subtitle">فیلم، سریال، انیمه</div>
    <p class="hero-desc">استریم مستقیم و پرسرعت از منابع معتبر ایرانی در استریمیو و نوویو با قابلیت شخصی‌سازی کامل مانیفست.</p>
    <div class="btn-row">
      <a class="btn btn-gold" href="${esc(stremioPublicUrl)}">نصب در استریمیو</a>
      <a class="btn btn-glass" href="${esc(stremioPublicUrl)}">نصب در نوویو</a>
      <a class="btn btn-glass" href="#install">شخصی‌سازی کاتالوگ</a>
    </div>
  </section>

  <!-- وضعیت منابع -->
  <section class="liquid-glass">
    <div class="section-header"><div class="section-title">وضعیت منابع</div></div>
    <div class="sources-grid" id="sourcesGrid">
      <div class="source-status-card" data-source="f2media" data-domain="myf2ms.top">
        <div class="src-info"><img class="src-favicon" src="${FAVICONS.f2media}" alt="F2Media"/><span class="src-name">F2Media</span></div>
        <div class="src-meta"><span class="status-pill"><i class="status-dot"></i><b class="st-txt">بررسی...</b></span></div>
      </div>
      <div class="source-status-card" data-source="cinamatic" data-domain="cinamatic.top">
        <div class="src-info"><img class="src-favicon" src="${FAVICONS.cinamatic}" alt="Cinamatic"/><span class="src-name">Cinamatic</span></div>
        <div class="src-meta"><span class="status-pill"><i class="status-dot"></i><b class="st-txt">بررسی...</b></span></div>
      </div>
      <div class="source-status-card" data-source="aslmoviez" data-domain="aslmoviez.com">
        <div class="src-info"><img class="src-favicon" src="${FAVICONS.aslmoviez}" alt="AslMoviez"/><span class="src-name">AslMoviez</span></div>
        <div class="src-meta"><span class="status-pill"><i class="status-dot"></i><b class="st-txt">بررسی...</b></span></div>
      </div>
      <div class="source-status-card" data-source="avamovie" data-domain="avadel.top">
        <div class="src-info"><img class="src-favicon" src="${FAVICONS.avamovie}" alt="AvaMovie"/><span class="src-name">AvaMovie</span></div>
        <div class="src-meta"><span class="status-pill"><i class="status-dot"></i><b class="st-txt">بررسی...</b></span></div>
      </div>
      <div class="source-status-card" data-source="digimovie" data-domain="digimoviez53.top">
        <div class="src-info"><img class="src-favicon" src="${FAVICONS.digimovie}" alt="DigiMovie"/><span class="src-name">DigiMovie</span></div>
        <div class="src-meta"><span class="status-pill"><i class="status-dot"></i><b class="st-txt">بررسی...</b></span></div>
      </div>
    </div>
  </section>

  <!-- نصب و پیکربندی (با کاتالوگ‌های جامع) -->
  <section class="liquid-glass" id="install">
    <div class="section-header"><div class="section-title">نصب و پیکربندی مانیفست</div></div>
    ${flashHtml}${installResult}
    
    <form method="post" action="/configure#install">
      <div class="providers-select-grid">
        <label class="prov-checkbox-wrap"><input type="checkbox" id="chk-f2media" name="providers" value="f2media"${selAttr('f2media')}/><div class="prov-pill-box"><img class="src-favicon" src="${FAVICONS.f2media}"/><span>F2Media</span><div class="custom-tick"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div></div></label>
        <label class="prov-checkbox-wrap"><input type="checkbox" id="chk-cinamatic" name="providers" value="cinamatic"${selAttr('cinamatic')}/><div class="prov-pill-box"><img class="src-favicon" src="${FAVICONS.cinamatic}"/><span>Cinamatic</span><div class="custom-tick"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div></div></label>
        <label class="prov-checkbox-wrap"><input type="checkbox" id="chk-aslmoviez" name="providers" value="aslmoviez"${selAttr('aslmoviez')}/><div class="prov-pill-box"><img class="src-favicon" src="${FAVICONS.aslmoviez}"/><span>AslMoviez</span><div class="custom-tick"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div></div></label>
        <label class="prov-checkbox-wrap"><input type="checkbox" id="chk-ava" name="providers" value="avamovie"${selAttr('avamovie')}/><div class="prov-pill-box"><img class="src-favicon" src="${FAVICONS.avamovie}"/><span>AvaMovie</span><div class="custom-tick"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div></div></label>
        <label class="prov-checkbox-wrap"><input type="checkbox" id="chk-digi" name="providers" value="digimovie"${selAttr('digimovie')}/><div class="prov-pill-box"><img class="src-favicon" src="${FAVICONS.digimovie}"/><span>DigiMovie</span><div class="custom-tick"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div></div></label>
      </div>

      <div class="config-drawers">
        <!-- دراور F2Media -->
        <div class="config-drawer ${isSel('f2media') ? 'open' : ''}" id="drawer-f2media">
          <div class="drawer-header"><img class="src-favicon" src="${FAVICONS.f2media}"/><span>کاتالوگ‌های F2Media</span></div>
          <div class="catalog-list">
            <label class="cat-chip"><input type="checkbox" name="f2media_cat" value="movies"${catSel('f2media','movies')}/> فیلم‌ها</label>
            <label class="cat-chip"><input type="checkbox" name="f2media_cat" value="series"${catSel('f2media','series')}/> سریال‌ها</label>
            <label class="cat-chip"><input type="checkbox" name="f2media_cat" value="dubbed"${catSel('f2media','dubbed')}/> دوبله فارسی</label>
            <label class="cat-chip"><input type="checkbox" name="f2media_cat" value="anime"${catSel('f2media','anime')}/> انیمه</label>
            <label class="cat-chip"><input type="checkbox" name="f2media_cat" value="animation"${catSel('f2media','animation')}/> انیمیشن</label>
            <label class="cat-chip"><input type="checkbox" name="f2media_cat" value="hindi"${catSel('f2media','hindi')}/> هندی</label>
          </div>
        </div>

        <!-- دراور Cinamatic -->
        <div class="config-drawer ${isSel('cinamatic') ? 'open' : ''}" id="drawer-cinamatic">
          <div class="drawer-header"><img class="src-favicon" src="${FAVICONS.cinamatic}"/><span>کاتالوگ‌های Cinamatic</span></div>
          <div class="catalog-list">
            <label class="cat-chip"><input type="checkbox" name="cinamatic_cat" value="movies"${catSel('cinamatic','movies')}/> فیلم‌ها</label>
            <label class="cat-chip"><input type="checkbox" name="cinamatic_cat" value="series"${catSel('cinamatic','series')}/> سریال‌ها</label>
            <label class="cat-chip"><input type="checkbox" name="cinamatic_cat" value="dubbed"${catSel('cinamatic','dubbed')}/> دوبله فارسی</label>
            <label class="cat-chip"><input type="checkbox" name="cinamatic_cat" value="anime"${catSel('cinamatic','anime')}/> انیمه</label>
          </div>
        </div>

        <!-- دراور AslMoviez -->
        <div class="config-drawer ${isSel('aslmoviez') ? 'open' : ''}" id="drawer-aslmoviez">
          <div class="drawer-header"><img class="src-favicon" src="${FAVICONS.aslmoviez}"/><span>کاتالوگ‌های AslMoviez</span></div>
          <div class="catalog-list">
            <label class="cat-chip"><input type="checkbox" name="aslmoviez_cat" value="movies"${catSel('aslmoviez','movies')}/> فیلم‌ها</label>
            <label class="cat-chip"><input type="checkbox" name="aslmoviez_cat" value="series"${catSel('aslmoviez','series')}/> سریال‌ها</label>
            <label class="cat-chip"><input type="checkbox" name="aslmoviez_cat" value="dubbed"${catSel('aslmoviez','dubbed')}/> دوبله</label>
            <label class="cat-chip"><input type="checkbox" name="aslmoviez_cat" value="anime"${catSel('aslmoviez','anime')}/> انیمه</label>
          </div>
        </div>

        <!-- دراور AvaMovie -->
        <div class="config-drawer ${isSel('avamovie') ? 'open' : ''}" id="drawer-ava">
          <div class="drawer-header"><img class="src-favicon" src="${FAVICONS.avamovie}"/><span>تنظیمات و کاتالوگ‌های AvaMovie</span></div>
          <div class="catalog-list">
            <label class="cat-chip"><input type="checkbox" name="avamovie_cat" value="movies"${catSel('avamovie','movies')}/> فیلم‌ها</label>
            <label class="cat-chip"><input type="checkbox" name="avamovie_cat" value="series"${catSel('avamovie','series')}/> سریال‌ها</label>
            <label class="cat-chip"><input type="checkbox" name="avamovie_cat" value="dubbed"${catSel('avamovie','dubbed')}/> دوبله</label>
            <label class="cat-chip"><input type="checkbox" name="avamovie_cat" value="anime"${catSel('avamovie','anime')}/> انیمه</label>
            <label class="cat-chip"><input type="checkbox" name="avamovie_cat" value="korean"${catSel('avamovie','korean')}/> کره‌ای</label>
            <label class="cat-chip"><input type="checkbox" name="avamovie_cat" value="hindi"${catSel('avamovie','hindi')}/> هندی</label>
          </div>
          <div class="form-inputs-grid">
            <div class="form-group"><label>کوکی حساب (Cookie)</label><input type="password" name="avaCookie" class="ltr-input" value="${esc(cookieValue)}" placeholder="your cookie here"/></div>
            <div class="form-group"><label>آدرس دامنه</label><input type="text" name="avaBaseUrl" class="ltr-input" value="${esc(avaBaseUrl)}"/></div>
          </div>
        </div>

        <!-- دراور DigiMovie -->
        <div class="config-drawer ${isSel('digimovie') ? 'open' : ''}" id="drawer-digi">
          <div class="drawer-header"><img class="src-favicon" src="${FAVICONS.digimovie}"/><span>تنظیمات و کاتالوگ‌های DigiMovie</span></div>
          <div class="catalog-list">
            <label class="cat-chip"><input type="checkbox" name="digimovie_cat" value="movies"${catSel('digimovie','movies')}/> فیلم‌ها</label>
            <label class="cat-chip"><input type="checkbox" name="digimovie_cat" value="series"${catSel('digimovie','series')}/> سریال‌ها</label>
            <label class="cat-chip"><input type="checkbox" name="digimovie_cat" value="dubbed"${catSel('digimovie','dubbed')}/> دوبله</label>
            <label class="cat-chip"><input type="checkbox" name="digimovie_cat" value="anime"${catSel('digimovie','anime')}/> انیمه</label>
          </div>
          <div class="form-inputs-grid">
            <div class="form-group"><label>کوکی حساب (Cookie)</label><input type="password" name="digiCookie" class="ltr-input" value="${esc(digiCookieValue)}" placeholder="your cookie here"/></div>
            <div class="form-group"><label>آدرس دامنه</label><input type="text" name="digiBaseUrl" class="ltr-input" value="${esc(digiBaseUrl)}"/></div>
          </div>
        </div>
      </div>

      <button type="submit" class="btn btn-gold" style="width:100%; padding: 14px;">ساخت مانیفست شخصی</button>
    </form>
  </section>
</main>

<script>
(function(){
  document.querySelectorAll('[data-copy]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var val = btn.getAttribute('data-copy') || '';
      var orig = btn.getAttribute('data-label') || 'کپی لینک';
      var span = btn.querySelector('span') || btn;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(val).then(function(){
          btn.classList.add('copied'); span.textContent = 'کپی شد!';
          setTimeout(function(){ btn.classList.remove('copied'); span.textContent = orig; }, 1800);
        });
      }
    });
  });

  const toggleDrawer = (chkId, drawerId) => {
    var chk = document.getElementById(chkId);
    var drawer = document.getElementById(drawerId);
    if (chk && drawer) chk.addEventListener('change', function(){ drawer.classList.toggle('open', chk.checked); });
  };
  toggleDrawer('chk-f2media', 'drawer-f2media');
  toggleDrawer('chk-cinamatic', 'drawer-cinamatic');
  toggleDrawer('chk-aslmoviez', 'drawer-aslmoviez');
  toggleDrawer('chk-ava', 'drawer-ava');
  toggleDrawer('chk-digi', 'drawer-digi');

  function setStatus(card, isOnline) {
    var pill = card.querySelector('.status-pill');
    var txt = card.querySelector('.st-txt');
    if (!pill || !txt) return;
    pill.classList.remove('online', 'offline');
    pill.classList.add(isOnline ? 'online' : 'offline');
    txt.textContent = isOnline ? 'آنلاین' : 'آفلاین';
  }

  fetch('/api/sources-status')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => {
      document.querySelectorAll('.source-status-card[data-source]').forEach(card => {
        var key = card.getAttribute('data-source');
        if (data && typeof data[key] === 'boolean') setStatus(card, data[key]);
      });
    })
    .catch(() => {
      document.querySelectorAll('.source-status-card[data-domain]').forEach(card => {
        var domain = card.getAttribute('data-domain');
        fetch('https://' + domain, { mode: 'no-cors' })
          .then(() => setStatus(card, true)).catch(() => setStatus(card, false));
      });
    });
})();
</script>
</body>
</html>`
}

export default renderLanding