/**
 * CinemaGraphy NEXT — Complete Liquid Glass Modern RTL Landing Page
 * Includes: Hero, 3 Features, Client Downloads (Stremio & Nuvio), Live Sources Status, Simple Provider Config, and Donation
 */
import { ASSET_BG, ASSET_MARK, ASSET_FAV, ASSET_DIGI_FAV } from './landing-assets.js'

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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

  const flashHtml = flash
    ? `<div class="flash ${flash.ok ? 'ok' : 'err'}" role="status"><span>${esc(flash.msg)}</span></div>`
    : ''

  const installResult = personalPath
    ? `<div class="custom-result" style="border: 1px solid rgba(16, 185, 129, 0.4); margin-bottom: 16px;">
        <div class="result-head">
          <span class="result-badge">آماده نصب</span>
          <span class="result-title">مانیفست شخصی شما ساخته شد</span>
        </div>
        <div class="result-url" dir="ltr">${esc(personalPath)}</div>
        <div class="btn-row" style="justify-content: flex-start; margin-top: 8px;">
          <a class="btn btn-gold" href="stremio://${esc(stripProto(personalPath))}">نصب در استریمیو</a>
          <a class="btn btn-nuvio" href="stremio://${esc(stripProto(personalPath))}">نصب در نوویو</a>
          <button type="button" class="btn btn-glass" data-copy="${esc(personalPath)}" data-label="کپی لینک"><span>کپی لینک</span></button>
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
  --radius: 22px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: 'Vazirmatn', Tahoma, sans-serif;
  background-color: var(--bg);
  color: var(--text);
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
  line-height: 1.6;
}
.bg-layer {
  position: fixed;
  inset: 0;
  background: url('${ASSET_BG}') center/cover no-repeat;
  filter: brightness(0.4) contrast(1.1);
  z-index: -2;
}
.bg-overlay {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at 50% 20%, rgba(5,7,13,0.3) 0%, rgba(5,7,13,0.86) 75%, #05070d 100%);
  z-index: -1;
}
.page-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 28px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* افکت Liquid Glass بهینه */
.liquid-glass {
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-top: 1px solid rgba(255, 255, 255, 0.16);
  border-left: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius);
  padding: 26px 22px;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
  position: relative;
  overflow: hidden;
}

/* هیرو */
.hero-section {
  text-align: center;
  border-color: rgba(245, 158, 11, 0.25);
  border-top-color: rgba(245, 158, 11, 0.4);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55), inset 0 1px 20px rgba(245, 158, 11, 0.05);
}
.logo-badge-wrap {
  width: 96px;
  height: 96px;
  margin: 0 auto 14px;
  border-radius: 50%;
  background: #090d18;
  border: 2px solid rgba(245, 158, 11, 0.4);
  box-shadow: 0 0 30px var(--gold-glow);
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.logo-badge-wrap img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform: scale(1.05);
}
.version-tag {
  display: inline-block;
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--gold);
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  padding: 3px 14px;
  border-radius: 999px;
  margin-bottom: 10px;
  direction: ltr;
}
.hero-section h1 {
  font-size: clamp(1.8rem, 4.5vw, 2.4rem);
  font-weight: 900;
  margin-bottom: 4px;
  letter-spacing: -0.02em;
}
.hero-section h1 span {
  background: linear-gradient(135deg, #fde047 0%, #f59e0b 50%, #ea580c 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hero-subtitle {
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--gold);
  margin-bottom: 10px;
}
.hero-desc {
  font-size: 0.88rem;
  color: var(--muted);
  max-width: 520px;
  margin: 0 auto 22px;
}

/* دکمه‌ها */
.btn-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 18px;
  border-radius: 13px;
  font-family: inherit;
  font-size: 0.86rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}
.btn:hover { transform: translateY(-2px); }
.btn:active { transform: scale(0.96); }
.btn-gold {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #05070d;
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.35);
}
.btn-nuvio {
  background: rgba(245, 158, 11, 0.14);
  color: #fde68a;
  border-color: rgba(245, 158, 11, 0.35);
}
.btn-nuvio:hover {
  background: rgba(245, 158, 11, 0.24);
  border-color: var(--gold);
}
.btn-glass {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  border-left: 1px solid rgba(255, 255, 255, 0.15);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(10px);
}
.btn-glass:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(245, 158, 11, 0.4);
  color: var(--gold);
}
.btn.copied {
  background: rgba(16, 185, 129, 0.2) !important;
  color: #34d399 !important;
  border-color: rgba(16, 185, 129, 0.4) !important;
}

/* ویژگی‌های ۳گانه */
.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.feature-box {
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  padding: 15px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.feature-icon {
  width: 42px;
  height: 42px;
  border-radius: 11px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.28);
  color: var(--gold);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.feature-icon svg { width: 20px; height: 20px; }
.feature-text h3 { font-size: 0.88rem; font-weight: 800; margin-bottom: 2px; }
.feature-text p { font-size: 0.74rem; color: var(--muted); }

/* سرتیترها */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.02rem;
  font-weight: 800;
}
.section-title svg { width: 19px; height: 19px; color: var(--gold); }

/* دانلود کلاینت پخش */
.clients-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.client-column {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.client-top {
  display: flex;
  align-items: center;
  gap: 9px;
}
.client-top img { width: 26px; height: 26px; border-radius: 6px; object-fit: contain; }
.client-top strong { font-size: 0.94rem; font-weight: 800; }
.client-top span { font-size: 0.73rem; color: var(--muted); margin-right: auto; }
.chips-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.platform-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 11px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text);
  font-size: 0.76rem;
  font-weight: 600;
  text-decoration: none;
  direction: ltr;
  transition: all 0.15s;
}
.platform-chip:hover {
  background: rgba(245, 158, 11, 0.16);
  border-color: rgba(245, 158, 11, 0.45);
  color: #fde68a;
}

/* وضعیت منابع */
.sources-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}
.source-status-card {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 14px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.src-info { display: flex; align-items: center; gap: 8px; direction: ltr; }
.src-favicon {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  object-fit: contain;
  background: rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.src-name { font-size: 0.8rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.src-meta { display: flex; align-items: center; justify-content: space-between; font-size: 0.68rem; }
.status-pill { display: inline-flex; align-items: center; gap: 5px; font-weight: 700; color: var(--muted); }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); }
.status-pill.online { color: #34d399; }
.status-pill.online .status-dot { background: #10b981; box-shadow: 0 0 8px #10b981; }
.status-pill.offline { color: #f87171; }
.status-pill.offline .status-dot { background: #ef4444; }
.tag-sub {
  background: rgba(249, 115, 22, 0.15);
  color: #fdba74;
  border: 1px solid rgba(249, 115, 22, 0.3);
  padding: 1px 6px;
  border-radius: 5px;
  font-size: 0.63rem;
  font-weight: 700;
}
.tag-free { color: var(--muted); font-size: 0.63rem; }

/* فرم نصب و پیکربندی */
.providers-select-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
.prov-checkbox-wrap { position: relative; cursor: pointer; user-select: none; }
.prov-checkbox-wrap input { position: absolute; opacity: 0; pointer-events: none; }
.prov-pill-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 10px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.07);
  transition: all 0.2s;
}
.prov-pill-box span { font-size: 0.8rem; font-weight: 800; direction: ltr; }
.custom-tick {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 1.5px solid var(--muted);
  margin-right: auto;
  display: grid;
  place-items: center;
}
.custom-tick svg { width: 12px; height: 12px; opacity: 0; stroke: #05070d; }
.prov-checkbox-wrap input:checked + .prov-pill-box {
  background: rgba(245, 158, 11, 0.15);
  border-color: var(--gold);
}
.prov-checkbox-wrap input:checked + .prov-pill-box .custom-tick {
  background: var(--gold);
  border-color: var(--gold);
}
.prov-checkbox-wrap input:checked + .prov-pill-box .custom-tick svg { opacity: 1; }

.config-drawers { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
.config-drawer {
  display: none;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(245, 158, 11, 0.28);
  border-radius: 14px;
  padding: 16px;
}
.config-drawer.open { display: block; }
.drawer-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--gold);
  margin-bottom: 12px;
}
.form-inputs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 0.78rem; font-weight: 700; color: var(--muted); }
.ltr-input {
  direction: ltr;
  text-align: left;
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
  font-family: monospace;
  font-size: 0.85rem;
  outline: none;
}
.ltr-input:focus { border-color: var(--gold); background: rgba(0,0,0,0.4); }

.flash { padding: 12px 14px; border-radius: 12px; margin-bottom: 16px; font-size: 0.85rem; font-weight: 700; }
.flash.ok { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #6ee7b7; }
.flash.err { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; }

.custom-result { padding: 16px; border-radius: 14px; background: rgba(16, 185, 129, 0.1); }
.result-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.result-badge { background: #10b981; color: #fff; font-size: 0.7rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; }
.result-title { font-size: 0.9rem; font-weight: 800; }
.result-url {
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(0,0,0,0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-family: monospace;
  font-size: 0.8rem;
  color: #fde68a;
  word-break: break-all;
  margin-bottom: 12px;
}

@media (max-width: 768px) {
  .features-grid, .clients-grid, .form-inputs-grid { grid-template-columns: 1fr; }
  .sources-grid, .providers-select-grid { grid-template-columns: repeat(2, 1fr); }
  .liquid-glass { padding: 22px 16px; }
}
</style>
</head>
<body>
<div class="bg-layer"></div>
<div class="bg-overlay"></div>

<main class="page-container">
  <!-- ۱. بخش هیرو -->
  <section class="liquid-glass hero-section">
    <div class="logo-badge-wrap"><img src="${ASSET_MARK}" alt="CinemaGraphy NEXT"/></div>
    <span class="version-tag">v${esc(version)}</span>
    <h1>سینماگرافی <span>NEXT</span></h1>
    <div class="hero-subtitle">فیلم، سریال، انیمه</div>
    <p class="hero-desc">استریم مستقیم و پرسرعت از منابع معتبر ایرانی در استریمیو و نوویو با قابلیت شخصی‌سازی کامل مانیفست.</p>
    <div class="btn-row">
      <a class="btn btn-gold" href="${esc(stremioPublicUrl)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>نصب در استریمیو</span>
      </a>
      <a class="btn btn-nuvio" href="${esc(stremioPublicUrl)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        <span>نصب در نوویو</span>
      </a>
      <a class="btn btn-glass" href="#install">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        <span>شخصی‌سازی</span>
      </a>
      <button type="button" class="btn btn-glass" data-copy="${esc(hostManifest)}" data-label="لینک مانیفست عمومی">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span>لینک مانیفست عمومی</span>
      </button>
    </div>
  </section>

  <!-- ۲. ویژگی‌های ۳گانه -->
  <section class="features-grid">
    <div class="feature-box">
      <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></div>
      <div class="feature-text"><h3>منابع ایرانی</h3><p>لینک‌های مستقیم و پرسرعت</p></div>
    </div>
    <div class="feature-box">
      <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg></div>
      <div class="feature-text"><h3>بدون کلید اجباری</h3><p>مستقل با متای عمومی</p></div>
    </div>
    <div class="feature-box">
      <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div>
      <div class="feature-text"><h3>مانیفست شخصی</h3><p>انتخاب منابع دلخواه</p></div>
    </div>
  </section>

  <!-- ۳. دانلود کلاینت پخش (استریمیو و نوویو) -->
  <section class="liquid-glass" id="clients">
    <div class="section-header">
      <div class="section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>دانلود کلاینت پخش</span>
      </div>
    </div>
    <div class="clients-grid">
      <div class="client-column">
        <div class="client-top">
          <img src="https://www.google.com/s2/favicons?domain=stremio.com&sz=64" alt="Stremio"/>
          <strong>Stremio</strong>
          <span>پخش‌کننده استاندارد</span>
        </div>
        <div class="chips-wrap">
          <a class="platform-chip" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">Windows</a>
          <a class="platform-chip" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">macOS</a>
          <a class="platform-chip" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">Linux</a>
          <a class="platform-chip" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">Android</a>
          <a class="platform-chip" href="https://apps.apple.com/app/stremio/id1297124690" target="_blank" rel="noopener">iOS</a>
          <a class="platform-chip" href="https://web.stremio.com/" target="_blank" rel="noopener">نسخه وب</a>
        </div>
      </div>
      <div class="client-column">
        <div class="client-top">
          <img src="https://www.google.com/s2/favicons?domain=nuvio.tv&sz=64" alt="Nuvio"/>
          <strong>Nuvio</strong>
          <span>پخش‌کننده نسل جدید</span>
        </div>
        <div class="chips-wrap">
          <a class="platform-chip" href="https://nuvio.tv/" target="_blank" rel="noopener">وب‌سایت</a>
          <a class="platform-chip" href="https://play.google.com/store/apps/details?id=com.nuvio.app" target="_blank" rel="noopener">Play Store</a>
          <a class="platform-chip" href="https://github.com/NuvioMedia/NuvioMobile/releases/latest" target="_blank" rel="noopener">Android APK</a>
          <a class="platform-chip" href="https://github.com/NuvioMedia/NuvioDesktop/releases/latest" target="_blank" rel="noopener">Desktop</a>
          <a class="platform-chip" href="https://testflight.apple.com/join/u4y7MHK9" target="_blank" rel="noopener">TestFlight (iOS)</a>
        </div>
      </div>
    </div>
  </section>

  <!-- ۴. وضعیت منابع (آنلاین / آفلاین) -->
  <section class="liquid-glass">
    <div class="section-header">
      <div class="section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <span>وضعیت منابع (آنلاین / آفلاین)</span>
      </div>
    </div>
    <div class="sources-grid" id="sourcesGrid">
      <div class="source-status-card" data-source="f2media" data-domain="myf2ms.top">
        <div class="src-info"><img class="src-favicon" src="${FAVICONS.f2media}" alt="F2Media"/><span class="src-name">F2Media</span></div>
        <div class="src-meta"><span class="status-pill"><i class="status-dot"></i><b class="st-txt">بررسی...</b></span><span class="tag-free">رایگان</span></div>
      </div>
      <div class="source-status-card" data-source="cinamatic" data-domain="cinamatic.top">
        <div class="src-info"><img class="src-favicon" src="${FAVICONS.cinamatic}" alt="Cinamatic"/><span class="src-name">Cinamatic</span></div>
        <div class="src-meta"><span class="status-pill"><i class="status-dot"></i><b class="st-txt">بررسی...</b></span><span class="tag-free">رایگان</span></div>
      </div>
      <div class="source-status-card" data-source="aslmoviez" data-domain="aslmoviez.com">
        <div class="src-info"><img class="src-favicon" src="${FAVICONS.aslmoviez}" alt="AslMoviez"/><span class="src-name">AslMoviez</span></div>
        <div class="src-meta"><span class="status-pill"><i class="status-dot"></i><b class="st-txt">بررسی...</b></span><span class="tag-free">رایگان</span></div>
      </div>
      <div class="source-status-card" data-source="avamovie" data-domain="avadel.top">
        <div class="src-info"><img class="src-favicon" src="${FAVICONS.avamovie}" alt="AvaMovie"/><span class="src-name">AvaMovie</span></div>
        <div class="src-meta"><span class="status-pill"><i class="status-dot"></i><b class="st-txt">بررسی...</b></span><span class="tag-sub">اشتراک</span></div>
      </div>
      <div class="source-status-card" data-source="digimovie" data-domain="digimoviez53.top">
        <div class="src-info"><img class="src-favicon" src="${FAVICONS.digimovie}" alt="DigiMovie"/><span class="src-name">DigiMovie</span></div>
        <div class="src-meta"><span class="status-pill"><i class="status-dot"></i><b class="st-txt">بررسی...</b></span><span class="tag-sub">اشتراک</span></div>
      </div>
    </div>
  </section>

  <!-- ۵. نصب و پیکربندی مانیفست -->
  <section class="liquid-glass" id="install">
    <div class="section-header">
      <div class="section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
        <span>نصب و پیکربندی مانیفست</span>
      </div>
    </div>
    ${flashHtml}${installResult}
    
    <form method="post" action="/configure#install">
      <div class="providers-select-grid">
        <label class="prov-checkbox-wrap"><input type="checkbox" name="providers" value="f2media"${selAttr('f2media')}/><div class="prov-pill-box"><img class="src-favicon" src="${FAVICONS.f2media}" alt=""/><span>F2Media</span><div class="custom-tick"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div></div></label>
        <label class="prov-checkbox-wrap"><input type="checkbox" name="providers" value="cinamatic"${selAttr('cinamatic')}/><div class="prov-pill-box"><img class="src-favicon" src="${FAVICONS.cinamatic}" alt=""/><span>Cinamatic</span><div class="custom-tick"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div></div></label>
        <label class="prov-checkbox-wrap"><input type="checkbox" name="providers" value="aslmoviez"${selAttr('aslmoviez')}/><div class="prov-pill-box"><img class="src-favicon" src="${FAVICONS.aslmoviez}" alt=""/><span>AslMoviez</span><div class="custom-tick"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div></div></label>
        <label class="prov-checkbox-wrap"><input type="checkbox" id="chk-ava" name="providers" value="avamovie"${selAttr('avamovie')}/><div class="prov-pill-box"><img class="src-favicon" src="${FAVICONS.avamovie}" alt=""/><span>AvaMovie</span><div class="custom-tick"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div></div></label>
        <label class="prov-checkbox-wrap"><input type="checkbox" id="chk-digi" name="providers" value="digimovie"${selAttr('digimovie')}/><div class="prov-pill-box"><img class="src-favicon" src="${FAVICONS.digimovie}" alt=""/><span>DigiMovie</span><div class="custom-tick"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div></div></label>
      </div>

      <div class="config-drawers">
        <div class="config-drawer ${isSel('avamovie') ? 'open' : ''}" id="drawer-ava">
          <div class="drawer-header"><img class="src-favicon" src="${FAVICONS.avamovie}" alt=""/><span>تنظیمات اشتراک AvaMovie</span></div>
          <div class="form-inputs-grid">
            <div class="form-group"><label for="avaCookie">کوکی حساب (Cookie)</label><input type="password" id="avaCookie" name="avaCookie" class="ltr-input" value="${esc(cookieValue)}" autocomplete="off" placeholder="your cookie here"/></div>
            <div class="form-group"><label for="avaBaseUrl">آدرس دامنه (Base URL)</label><input type="text" id="avaBaseUrl" name="avaBaseUrl" class="ltr-input" value="${esc(avaBaseUrl)}" placeholder="https://avadel.top"/></div>
          </div>
        </div>

        <div class="config-drawer ${isSel('digimovie') ? 'open' : ''}" id="drawer-digi">
          <div class="drawer-header"><img class="src-favicon" src="${FAVICONS.digimovie}" alt=""/><span>تنظیمات اشتراک DigiMovie</span></div>
          <div class="form-inputs-grid">
            <div class="form-group"><label for="digiCookie">کوکی حساب (Cookie)</label><input type="password" id="digiCookie" name="digiCookie" class="ltr-input" value="${esc(digiCookieValue)}" autocomplete="off" placeholder="your cookie here"/></div>
            <div class="form-group"><label for="digiBaseUrl">آدرس دامنه (Base URL)</label><input type="text" id="digiBaseUrl" name="digiBaseUrl" class="ltr-input" value="${esc(digiBaseUrl)}" placeholder="https://digimoviez53.top"/></div>
          </div>
        </div>
      </div>

      <button type="submit" class="btn btn-gold" style="width:100%; padding: 14px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        <span>ساخت مانیفست شخصی</span>
      </button>
    </form>
  </section>

  <!-- ۶. بخش حمایت مالی از پروژه -->
  <section class="liquid-glass" style="padding: 18px 22px;">
    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
      <div>
        <div class="section-title" style="margin-bottom: 4px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span>حمایت مالی از پروژه</span>
        </div>
        <p style="font-size: 0.8rem; color: var(--muted);">برای پایداری سرورها و توسعه مستمر سینماگرافی NEXT</p>
      </div>
      <button type="button" class="btn btn-glass" disabled style="opacity: 0.65; cursor: not-allowed;">پرداخت — به‌زودی</button>
    </div>
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
        var domain = card.getAttribute('data-domain');
        if (data && typeof data[key] === 'boolean') {
          if (data[key]) setStatus(card, true);
          else {
            var img = new Image();
            img.onload = function() { setStatus(card, true); };
            img.onerror = function() { setStatus(card, false); };
            img.src = 'https://' + domain + '/favicon.ico?' + new Date().getTime();
          }
        }
      });
    })
    .catch(() => {
      document.querySelectorAll('.source-status-card[data-domain]').forEach(card => {
        var domain = card.getAttribute('data-domain');
        var img = new Image();
        img.onload = function() { setStatus(card, true); };
        img.onerror = function() { setStatus(card, false); };
        img.src = 'https://' + domain + '/favicon.ico?' + new Date().getTime();
      });
    });
})();
</script>
</body>
</html>`
}

export default renderLanding