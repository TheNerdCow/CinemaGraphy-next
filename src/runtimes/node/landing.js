/**
 * CinemaGraphy NEXT — RTL Persian Landing Page
 * Connected to landing-assets.js and server.js (/configure & /api/sources-status)
 */
import { ASSET_BG, ASSET_LOGO, ASSET_MARK, ASSET_FAV } from './landing-assets.js'

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
  const avaBaseUrl = opts.avaBaseUrl || ''
  const digiBaseUrl = opts.digiBaseUrl || ''
  const hostManifest = opts.hostManifest || '/manifest.json'
  const stremioPublicUrl = 'stremio://' + stripProto(hostManifest)

  const flashHtml = flash
    ? `<div class="flash ${flash.ok ? 'ok' : 'err'}" role="status">
        <span>${esc(flash.msg)}</span>
      </div>`
    : ''

  const installResult = personalPath
    ? `<div class="custom-result" id="custom-result">
        <div class="result-head">
          <span class="result-badge">آماده نصب</span>
          <span class="result-title">مانیفست شخصی شما ساخته شد</span>
        </div>
        <div class="result-url" dir="ltr">${esc(personalPath)}</div>
        <div class="result-actions">
          <a class="btn btn-gold" href="stremio://${esc(stripProto(personalPath))}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span>نصب در استریمیو</span>
          </a>
          <a class="btn btn-nuvio" href="stremio://${esc(stripProto(personalPath))}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            <span>نصب در نوویو</span>
          </a>
          <button type="button" class="btn btn-ghost" data-copy="${esc(personalPath)}" data-label="کپی لینک شخصی">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>کپی لینک شخصی</span>
          </button>
        </div>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>سینماگرافی NEXT | افزونه استریمیو و نوویو</title>
<meta name="description" content="فیلم، سریال و انیمه از منابع ایرانی در استریمیو و نوویو"/>
<link rel="icon" href="${ASSET_FAV}"/>
<link rel="apple-touch-icon" href="${ASSET_LOGO}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
:root {
  --bg: #070912;
  --card: rgba(12, 16, 28, 0.74);
  --card-solid: #0b0f1c;
  --line: rgba(255, 255, 255, 0.08);
  --gold-line: rgba(232, 163, 23, 0.34);
  --gold: #e8a317;
  --orange: #f97316;
  --text: #f8fafc;
  --muted: #94a3b8;
  --ok: #10b981;
  --err: #ef4444;
  --radius: 14px;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: 'Vazirmatn', Tahoma, system-ui, -apple-system, sans-serif;
  background-color: var(--bg);
  color: var(--text);
  line-height: 1.55;
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
}

/* پس‌زمینه قلعه سینمایی با اورلی تیره نیمه‌شفاف */
.bg-castle {
  position: fixed;
  inset: 0;
  background: url('${ASSET_BG}') center top / cover no-repeat;
  filter: brightness(0.42) contrast(1.06) saturate(1.05);
  z-index: -2;
}

.bg-overlay {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(circle at 50% 12%, rgba(7, 9, 18, 0.45) 0%, rgba(7, 9, 18, 0.88) 70%, #070912 100%),
    linear-gradient(180deg, rgba(7, 9, 18, 0.35) 0%, rgba(7, 9, 18, 0.95) 100%);
  z-index: -1;
}

.page-wrap {
  max-width: 920px;
  margin: 0 auto;
  padding: 20px 16px 36px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.glass {
  background: var(--card);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 18px;
  box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.65);
}

/* ۱. هیرو */
.hero {
  text-align: center;
  padding: 24px 18px 22px;
  border-color: rgba(232, 163, 23, 0.22);
}

.hero-logo-card {
  width: 86px;
  height: 86px;
  margin: 0 auto 10px;
  border-radius: 50%;
  background: var(--card-solid);
  border: 1.5px solid var(--gold-line);
  box-shadow: 0 0 26px rgba(232, 163, 23, 0.22), inset 0 0 12px rgba(232, 163, 23, 0.08);
  padding: 4px;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.hero-logo-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.v-badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--gold);
  background: rgba(232, 163, 23, 0.12);
  border: 1px solid rgba(232, 163, 23, 0.28);
  padding: 2px 10px;
  border-radius: 999px;
  margin-bottom: 8px;
  direction: ltr;
}

.hero h1 {
  font-size: clamp(1.55rem, 3.6vw, 2.05rem);
  font-weight: 900;
  letter-spacing: -0.02em;
  margin-bottom: 2px;
}

.hero h1 .next {
  background: linear-gradient(135deg, #fde047 0%, var(--gold) 55%, var(--orange) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-sub {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--gold);
  margin-bottom: 6px;
}

.hero-desc {
  font-size: 0.84rem;
  color: var(--muted);
  max-width: 460px;
  margin: 0 auto 16px;
}

.btn-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 15px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 0.83rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid transparent;
  transition: transform 0.14s ease, box-shadow 0.14s ease, background 0.14s ease, border-color 0.14s ease;
  user-select: none;
}

.btn svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.btn:hover {
  transform: translateY(-1px);
  text-decoration: none;
}

.btn:active {
  transform: scale(0.96);
}

.btn-gold {
  background: linear-gradient(135deg, var(--gold) 0%, var(--orange) 100%);
  color: #070912;
  box-shadow: 0 4px 16px rgba(232, 163, 23, 0.28);
}

.btn-gold:hover {
  box-shadow: 0 6px 22px rgba(232, 163, 23, 0.42);
  filter: brightness(1.06);
}

.btn-nuvio {
  background: rgba(232, 163, 23, 0.13);
  color: #fde68a;
  border-color: rgba(232, 163, 23, 0.35);
}

.btn-nuvio:hover {
  background: rgba(232, 163, 23, 0.22);
  border-color: var(--gold);
}

.btn-ghost {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  border-color: var(--line);
}

.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(232, 163, 23, 0.35);
  color: var(--gold);
}

.btn.copied {
  background: rgba(16, 185, 129, 0.18) !important;
  color: #34d399 !important;
  border-color: rgba(16, 185, 129, 0.45) !important;
}

/* ۲. کارت‌های کوتاه (۳ عدد) */
.mini-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.mini-card {
  background: var(--card);
  backdrop-filter: blur(14px);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 11px;
}

.mini-icon {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: rgba(232, 163, 23, 0.12);
  border: 1px solid rgba(232, 163, 23, 0.25);
  color: var(--gold);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.mini-icon svg {
  width: 18px;
  height: 18px;
}

.mini-card h3 {
  font-size: 0.84rem;
  font-weight: 800;
  margin-bottom: 1px;
}

.mini-card p {
  font-size: 0.73rem;
  color: var(--muted);
}

/* سرتیتر بخش‌ها */
.sec-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.sec-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.94rem;
  font-weight: 800;
}

.sec-title svg {
  width: 18px;
  height: 18px;
  color: var(--gold);
}

/* ۳. دانلود کلاینت (دو ستون یکپارچه) */
.clients-wrap {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.client-box {
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--line);
  border-radius: 11px;
  padding: 13px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.client-head {
  display: flex;
  align-items: center;
  gap: 9px;
}

.client-head img {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  object-fit: contain;
}

.client-head strong {
  font-size: 0.9rem;
  font-weight: 800;
}

.client-head span {
  font-size: 0.72rem;
  color: var(--muted);
  margin-right: auto;
}

.plat-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.plat-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid var(--line);
  color: var(--text);
  font-size: 0.74rem;
  font-weight: 600;
  text-decoration: none;
  direction: ltr;
  transition: all 0.14s ease;
}

.plat-link svg {
  width: 13px;
  height: 13px;
  color: var(--muted);
  transition: color 0.14s;
}

.plat-link:hover {
  border-color: rgba(232, 163, 23, 0.45);
  background: rgba(232, 163, 23, 0.12);
  color: #fde68a;
  text-decoration: none;
}

.plat-link:hover svg {
  color: var(--gold);
}

/* ۴. منابع و وضعیت */
.sources-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.src-card {
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.src-head {
  display: flex;
  align-items: center;
  gap: 7px;
  direction: ltr;
}

.src-fav {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  object-fit: contain;
  flex-shrink: 0;
}

.src-name {
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.src-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.68rem;
}

.st-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  color: var(--muted);
}

.st-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--muted);
}

.st-badge.online {
  color: #34d399;
}

.st-badge.online .st-dot {
  background: var(--ok);
  box-shadow: 0 0 7px var(--ok);
}

.st-badge.offline {
  color: #f87171;
}

.st-badge.offline .st-dot {
  background: var(--err);
}

.tag-sub {
  background: rgba(249, 115, 22, 0.14);
  color: #fdba74;
  border: 1px solid rgba(249, 115, 22, 0.3);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.64rem;
  font-weight: 600;
}

.tag-free {
  color: var(--muted);
  font-size: 0.64rem;
}

/* ۵. نصب و پیکربندی */
.prov-select-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.prov-chk {
  position: relative;
  cursor: pointer;
  user-select: none;
}

.prov-chk input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.prov-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line);
  transition: all 0.15s ease;
}

.prov-pill span {
  font-size: 0.78rem;
  font-weight: 700;
  direction: ltr;
}

.tick-box {
  width: 15px;
  height: 15px;
  border-radius: 4px;
  border: 1.5px solid var(--muted);
  margin-right: auto;
  display: grid;
  place-items: center;
  transition: all 0.15s;
}

.tick-box svg {
  width: 11px;
  height: 11px;
  opacity: 0;
  stroke: #070912;
}

.prov-chk input:checked + .prov-pill {
  background: rgba(232, 163, 23, 0.12);
  border-color: var(--gold);
}

.prov-chk input:checked + .prov-pill .tick-box {
  background: var(--gold);
  border-color: var(--gold);
}

.prov-chk input:checked + .prov-pill .tick-box svg {
  opacity: 1;
}

.sub-panels {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.sub-drawer {
  display: none;
  background: rgba(7, 9, 18, 0.6);
  border: 1px solid rgba(232, 163, 23, 0.26);
  border-radius: 11px;
  padding: 12px;
}

.sub-drawer.open {
  display: block;
}

.sub-drawer-head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--gold);
  margin-bottom: 9px;
}

.inputs-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.inp-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.inp-group label {
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--muted);
}

.ltr-field {
  direction: ltr;
  text-align: left;
  width: 100%;
  padding: 8px 11px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.79rem;
  outline: none;
}

.ltr-field:focus {
  border-color: var(--gold);
}

.flash {
  padding: 10px 12px;
  border-radius: 9px;
  margin-bottom: 12px;
  font-size: 0.82rem;
  font-weight: 600;
}

.flash.ok {
  background: rgba(16, 185, 129, 0.14);
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: #6ee7b7;
}

.flash.err {
  background: rgba(239, 68, 68, 0.14);
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: #fca5a5;
}

.custom-result {
  margin-bottom: 14px;
  padding: 13px;
  border-radius: 11px;
  background: rgba(232, 163, 23, 0.08);
  border: 1px solid rgba(232, 163, 23, 0.35);
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-badge {
  background: var(--gold);
  color: #070912;
  font-size: 0.68rem;
  font-weight: 800;
  padding: 1px 7px;
  border-radius: 5px;
}

.result-title {
  font-size: 0.84rem;
  font-weight: 700;
}

.result-url {
  padding: 7px 10px;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--line);
  font-family: ui-monospace, monospace;
  font-size: 0.74rem;
  color: #fde68a;
  word-break: break-all;
}

.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* ۶. حمایت مالی */
.donate-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.donate-sub {
  font-size: 0.78rem;
  color: var(--muted);
  margin-top: 2px;
}

.supporters-box {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.74rem;
  color: var(--muted);
}

@media (max-width: 760px) {
  .mini-cards,
  .clients-wrap,
  .inputs-2col {
    grid-template-columns: 1fr;
  }
  .sources-row,
  .prov-select-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
</head>
<body>
<div class="bg-castle"></div>
<div class="bg-overlay"></div>

<main class="page-wrap">
  <!-- ۱. هیرو -->
  <section class="glass hero">
    <div class="hero-logo-card">
      <img src="${ASSET_MARK}" alt="CinemaGraphy NEXT"/>
    </div>
    <span class="v-badge">v${esc(version)}</span>
    <h1>سینماگرافی <span class="next">NEXT</span></h1>
    <div class="hero-sub">فیلم، سریال، انیمه</div>
    <p class="hero-desc">استریم مستقیم از منابع ایرانی در استریمیو و نوویو با امکان ساخت مانیفست اختصاصی.</p>

    <div class="btn-row">
      <a class="btn btn-gold" href="${esc(stremioPublicUrl)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>نصب در استریمیو</span>
      </a>
      <a class="btn btn-nuvio" href="${esc(stremioPublicUrl)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        <span>نصب در نوویو</span>
      </a>
      <a class="btn btn-ghost" href="#install">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
        <span>شخصی‌سازی</span>
      </a>
      <button type="button" class="btn btn-ghost" data-copy="${esc(hostManifest)}" data-label="لینک مانیفست عمومی">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span>لینک مانیفست عمومی</span>
      </button>
    </div>
  </section>

  <!-- ۲. کارت‌های کوتاه (۳ عدد) -->
  <section class="mini-cards">
    <div class="mini-card">
      <div class="mini-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
      </div>
      <div>
        <h3>منابع ایرانی</h3>
        <p>لینک‌های مستقیم و پرسرعت داخلی</p>
      </div>
    </div>
    <div class="mini-card">
      <div class="mini-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
      </div>
      <div>
        <h3>بدون کلید اجباری / متا</h3>
        <p>مستقل از کلید API با متای عمومی</p>
      </div>
    </div>
    <div class="mini-card">
      <div class="mini-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </div>
      <div>
        <h3>شخصی‌سازی مانیفست</h3>
        <p>انتخاب منابع دلخواه و کوکی اشتراک</p>
      </div>
    </div>
  </section>

  <!-- ۳. دانلود کلاینت -->
  <section class="glass" id="clients">
    <div class="sec-bar">
      <div class="sec-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>دانلود کلاینت</span>
      </div>
    </div>
    <div class="clients-wrap">
      <div class="client-box">
        <div class="client-head">
          <img src="https://www.google.com/s2/favicons?domain=stremio.com&sz=64" alt="Stremio"/>
          <strong>Stremio</strong>
          <span>پخش‌کننده استاندارد</span>
        </div>
        <div class="plat-list">
          <a class="plat-link" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Windows
          </a>
          <a class="plat-link" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/></svg>
            macOS
          </a>
          <a class="plat-link" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            Linux
          </a>
          <a class="plat-link" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
            Android
          </a>
          <a class="plat-link" href="https://apps.apple.com/app/stremio/id1297124690" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg>
            iOS
          </a>
          <a class="plat-link" href="https://web.stremio.com/" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
            وب
          </a>
        </div>
      </div>

      <div class="client-box">
        <div class="client-head">
          <img src="https://www.google.com/s2/favicons?domain=nuvio.tv&sz=64" alt="Nuvio"/>
          <strong>Nuvio</strong>
          <span>سازگار با مانیفست استریمیو</span>
        </div>
        <div class="plat-list">
          <a class="plat-link" href="https://nuvio.tv/" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
            سایت رسمی
          </a>
          <a class="plat-link" href="https://play.google.com/store/apps/details?id=com.nuvio.app" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Play Store
          </a>
          <a class="plat-link" href="https://github.com/NuvioMedia/NuvioMobile/releases/latest" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
            Android
          </a>
          <a class="plat-link" href="https://github.com/NuvioMedia/NuvioDesktop/releases/latest" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Desktop
          </a>
          <a class="plat-link" href="https://testflight.apple.com/join/u4y7MHK9" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            TestFlight
          </a>
        </div>
      </div>
    </div>
  </section>

  <!-- ۴. منابع -->
  <section class="glass">
    <div class="sec-bar">
      <div class="sec-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <span>وضعیت منابع</span>
      </div>
    </div>
    <div class="sources-row" id="sourcesGrid">
      <div class="src-card" data-source="f2media" data-domain="f2m.site">
        <div class="src-head">
          <img class="src-fav" src="https://www.google.com/s2/favicons?domain=f2m.site&sz=64" alt="F2Media"/>
          <span class="src-name">F2Media</span>
        </div>
        <div class="src-foot">
          <span class="st-badge"><i class="st-dot"></i><b class="st-txt">بررسی...</b></span>
          <span class="tag-free">رایگان</span>
        </div>
      </div>

      <div class="src-card" data-source="cinamatic" data-domain="cinamatic.ir">
        <div class="src-head">
          <img class="src-fav" src="https://www.google.com/s2/favicons?domain=cinamatic.ir&sz=64" alt="Cinamatic"/>
          <span class="src-name">Cinamatic</span>
        </div>
        <div class="src-foot">
          <span class="st-badge"><i class="st-dot"></i><b class="st-txt">بررسی...</b></span>
          <span class="tag-free">رایگان</span>
        </div>
      </div>

      <div class="src-card" data-source="aslmoviez" data-domain="aslmoviez.com">
        <div class="src-head">
          <img class="src-fav" src="https://www.google.com/s2/favicons?domain=aslmoviez.com&sz=64" alt="AslMoviez"/>
          <span class="src-name">AslMoviez</span>
        </div>
        <div class="src-foot">
          <span class="st-badge"><i class="st-dot"></i><b class="st-txt">بررسی...</b></span>
          <span class="tag-free">رایگان</span>
        </div>
      </div>

      <div class="src-card" data-source="avamovie" data-domain="avamovie.shop">
        <div class="src-head">
          <img class="src-fav" src="https://www.google.com/s2/favicons?domain=avamovie.shop&sz=64" alt="AvaMovie"/>
          <span class="src-name">AvaMovie</span>
        </div>
        <div class="src-foot">
          <span class="st-badge"><i class="st-dot"></i><b class="st-txt">بررسی...</b></span>
          <span class="tag-sub">نیازمند اشتراک</span>
        </div>
      </div>

      <div class="src-card" data-source="digimovie" data-domain="digimoviez.com">
        <div class="src-head">
          <img class="src-fav" src="https://www.google.com/s2/favicons?domain=digimoviez.com&sz=64" alt="DigiMovie"/>
          <span class="src-name">DigiMovie</span>
        </div>
        <div class="src-foot">
          <span class="st-badge"><i class="st-dot"></i><b class="st-txt">بررسی...</b></span>
          <span class="tag-sub">نیازمند اشتراک</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ۵. نصب و پیکربندی -->
  <section class="glass" id="install">
    <div class="sec-bar">
      <div class="sec-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
        <span>نصب و پیکربندی</span>
      </div>
    </div>

    ${flashHtml}
    ${installResult}

    <form method="post" action="/configure#install">
      <div class="prov-select-grid">
        <label class="prov-chk">
          <input type="checkbox" name="providers" value="f2media"${selAttr('f2media')}/>
          <div class="prov-pill">
            <img class="src-fav" src="https://www.google.com/s2/favicons?domain=f2m.site&sz=64" alt=""/>
            <span>F2Media</span>
            <div class="tick-box"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          </div>
        </label>

        <label class="prov-chk">
          <input type="checkbox" name="providers" value="cinamatic"${selAttr('cinamatic')}/>
          <div class="prov-pill">
            <img class="src-fav" src="https://www.google.com/s2/favicons?domain=cinamatic.ir&sz=64" alt=""/>
            <span>Cinamatic</span>
            <div class="tick-box"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          </div>
        </label>

        <label class="prov-chk">
          <input type="checkbox" name="providers" value="aslmoviez"${selAttr('aslmoviez')}/>
          <div class="prov-pill">
            <img class="src-fav" src="https://www.google.com/s2/favicons?domain=aslmoviez.com&sz=64" alt=""/>
            <span>AslMoviez</span>
            <div class="tick-box"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          </div>
        </label>

        <label class="prov-chk">
          <input type="checkbox" id="chk-ava" name="providers" value="avamovie"${selAttr('avamovie')}/>
          <div class="prov-pill">
            <img class="src-fav" src="https://www.google.com/s2/favicons?domain=avamovie.shop&sz=64" alt=""/>
            <span>AvaMovie</span>
            <div class="tick-box"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          </div>
        </label>

        <label class="prov-chk">
          <input type="checkbox" id="chk-digi" name="providers" value="digimovie"${selAttr('digimovie')}/>
          <div class="prov-pill">
            <img class="src-fav" src="https://www.google.com/s2/favicons?domain=digimoviez.com&sz=64" alt=""/>
            <span>DigiMovie</span>
            <div class="tick-box"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          </div>
        </label>
      </div>

      <div class="sub-panels">
        <div class="sub-drawer ${isSel('avamovie') ? 'open' : ''}" id="drawer-ava">
          <div class="sub-drawer-head">
            <img class="src-fav" src="https://www.google.com/s2/favicons?domain=avamovie.shop&sz=64" alt=""/>
            <span>تنظیمات اشتراک AvaMovie</span>
          </div>
          <div class="inputs-2col">
            <div class="inp-group">
              <label for="avaCookie">کوکی AvaMovie</label>
              <input type="password" id="avaCookie" name="avaCookie" class="ltr-field" value="${esc(cookieValue)}" autocomplete="off" placeholder="your cookie here"/>
            </div>
            <div class="inp-group">
              <label for="avaBaseUrl">آدرس دامنه (Base URL اختیاری)</label>
              <input type="text" id="avaBaseUrl" name="avaBaseUrl" class="ltr-field" value="${esc(avaBaseUrl)}" placeholder="https://avamovie.shop"/>
            </div>
          </div>
        </div>

        <div class="sub-drawer ${isSel('digimovie') ? 'open' : ''}" id="drawer-digi">
          <div class="sub-drawer-head">
            <img class="src-fav" src="https://www.google.com/s2/favicons?domain=digimoviez.com&sz=64" alt=""/>
            <span>تنظیمات اشتراک DigiMovie</span>
          </div>
          <div class="inputs-2col">
            <div class="inp-group">
              <label for="digiCookie">کوکی DigiMovie</label>
              <input type="password" id="digiCookie" name="digiCookie" class="ltr-field" value="${esc(digiCookieValue)}" autocomplete="off" placeholder="your cookie here"/>
            </div>
            <div class="inp-group">
              <label for="digiBaseUrl">آدرس دامنه (Base URL اختیاری)</label>
              <input type="text" id="digiBaseUrl" name="digiBaseUrl" class="ltr-field" value="${esc(digiBaseUrl)}" placeholder="https://digimoviez.com"/>
            </div>
          </div>
        </div>
      </div>

      <button type="submit" class="btn btn-gold" style="width:100%;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        <span>ساخت مانیفست شخصی</span>
      </button>
    </form>
  </section>

  <!-- ۶. حمایت مالی -->
  <section class="glass">
    <div class="donate-row">
      <div>
        <div class="sec-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span>حمایت مالی</span>
        </div>
        <p class="donate-sub">حمایت از پایداری سرور و توسعه مستمر سینماگرافی NEXT</p>
      </div>
      <button type="button" class="btn btn-ghost" disabled style="opacity:0.6;cursor:not-allowed;">
        <span>پرداخت — به‌زودی</span>
      </button>
    </div>
    <div class="supporters-box">
      <span>آخرین حمایت‌ها</span>
      <span>—</span>
    </div>
  </section>
</main>

<script>
(function(){
  // کپی لینک با فیدبک بصری
  document.querySelectorAll('[data-copy]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var val = btn.getAttribute('data-copy') || '';
      var orig = btn.getAttribute('data-label') || 'کپی لینک';
      var span = btn.querySelector('span') || btn;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val).then(function(){
          btn.classList.add('copied');
          span.textContent = 'کپی شد!';
          setTimeout(function(){
            btn.classList.remove('copied');
            span.textContent = orig;
          }, 1800);
        });
      }
    });
  });

  // باز و بسته شدن شرطی فیلد کوکی Ava و Digi
  var chkAva = document.getElementById('chk-ava');
  var drawerAva = document.getElementById('drawer-ava');
  var chkDigi = document.getElementById('chk-digi');
  var drawerDigi = document.getElementById('drawer-digi');

  if (chkAva && drawerAva) {
    chkAva.addEventListener('change', function(){
      drawerAva.classList.toggle('open', chkAva.checked);
    });
  }
  if (chkDigi && drawerDigi) {
    chkDigi.addEventListener('change', function(){
      drawerDigi.classList.toggle('open', chkDigi.checked);
    });
  }

  // بررسی واقعی آنلاین/آفلاین بودن دامنه‌ها
  function setCardStatus(card, isOnline) {
    var badge = card.querySelector('.st-badge');
    var txt = card.querySelector('.st-txt');
    if (!badge || !txt) return;
    badge.classList.remove('online', 'offline');
    badge.classList.add(isOnline ? 'online' : 'offline');
    txt.textContent = isOnline ? 'آنلاین' : 'آفلاین';
  }

  fetch('/api/sources-status')
    .then(function(r){ return r.ok ? r.json() : Promise.reject(); })
    .then(function(data){
      document.querySelectorAll('.src-card[data-source]').forEach(function(card){
        var key = card.getAttribute('data-source');
        if (data && typeof data[key] === 'boolean') {
          setCardStatus(card, data[key]);
        }
      });
    })
    .catch(function(){
      document.querySelectorAll('.src-card[data-domain]').forEach(function(card){
        var domain = card.getAttribute('data-domain');
        var controller = new AbortController();
        var timer = setTimeout(function(){ controller.abort(); }, 6000);
        fetch('https://' + domain, { mode: 'no-cors', signal: controller.signal })
          .then(function(){ clearTimeout(timer); setCardStatus(card, true); })
          .catch(function(){ clearTimeout(timer); setCardStatus(card, false); });
      });
    });
})();
</script>
</body>
</html>`
}

export default renderLanding