/**
 * CinemaGraphy NEXT — cinematic landing + configure form
 * Brand assets from landing-assets.js (optimized webp/jpeg data-URIs)
 */

import { ASSET_BG, ASSET_LOGO, ASSET_MARK, ASSET_FAV } from './landing-assets.js'

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
}

function stripProto(u) {
  const s = String(u || '')
  if (s.startsWith('https://')) return s.slice(8)
  if (s.startsWith('http://')) return s.slice(7)
  return s
}

/**
 * @param {object} opts
 */
export function renderLanding(opts = {}) {
  const version = opts.version || '0.6.3'
  const free = opts.freeProviders || ['f2media', 'cinamatic', 'aslmoviez']
  const selected = opts.selected || free
  const sel = (k) => (selected.includes(k) ? ' checked' : '')
  const flash = opts.flash
  const personalPath = opts.personalPath || ''
  const cookieValue = opts.cookieValue || ''
  const digiCookieValue = opts.digiCookieValue || ''
  const avaBaseUrl = opts.avaBaseUrl || ''
  const digiBaseUrl = opts.digiBaseUrl || ''

  const flashHtml = flash
    ? `<div class="flash ${flash.ok ? 'ok' : 'err'}" role="status">${esc(flash.msg)}</div>`
    : ''

  const installResult = personalPath
    ? `<div class="install-box">
        <p class="install-title">مانیفست شخصی آماده است</p>
        <div class="install-actions">
          <a class="btn btn-primary" href="stremio://${esc(stripProto(personalPath))}">نصب در استریمیو</a>
          <button type="button" class="btn btn-ghost" data-copy="${esc(personalPath)}">کپی لینک مانیفست</button>
        </div>
        <code class="mono" dir="ltr">${esc(personalPath)}</code>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>CinemaGraphy NEXT · افزونه استریمیو</title>
<meta name="description" content="CinemaGraphy NEXT — نسل بعدی کشف محتوا برای استریمیو. منابع چندگانه، متادیتای بدون کلید API، نصب شخصی."/>
<meta property="og:title" content="CinemaGraphy NEXT"/>
<meta property="og:description" content="The next generation of multi-source content discovery for Stremio."/>
<meta property="og:type" content="website"/>
<link rel="icon" type="image/png" href="${ASSET_FAV}"/>
<style>
:root{
  --bg:#05070f; --navy:#0a1220; --card:rgba(12,18,32,.72); --line:rgba(120,160,220,.14);
  --text:#eef3fb; --muted:#94a3b8; --cyan:#22d3ee; --blue:#3b82f6; --amber:#f59e0b; --violet:#a78bfa;
  --radius:16px; --shadow:0 20px 50px rgba(0,0,0,.45);
  --font:Tahoma,"Segoe UI",system-ui,sans-serif;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{animation:none!important;transition:none!important}}
body{margin:0;font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.65;min-height:100vh}
a{color:var(--cyan);text-decoration:none}a:hover{text-decoration:underline}
img{max-width:100%;height:auto;display:block}
.site-header{position:sticky;top:0;z-index:50;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);background:rgba(5,8,16,.78);border-bottom:1px solid var(--line)}
.nav{max-width:1100px;margin:0 auto;padding:10px 18px;display:flex;align-items:center;gap:14px;justify-content:space-between}
.nav-brand{display:flex;align-items:center;gap:10px;font-weight:700;color:var(--text);text-decoration:none}
.nav-brand img{width:36px;height:36px;border-radius:8px}
.nav-links{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.nav-links a{color:var(--muted);padding:8px 10px;border-radius:8px;font-size:.88rem;text-decoration:none}
.nav-links a:hover{color:var(--text);background:rgba(255,255,255,.05)}
.nav-cta{background:linear-gradient(135deg,#7c3aed,#2563eb)!important;color:#fff!important;font-weight:700;padding:8px 14px!important}
.nav-toggle{display:none;background:transparent;border:1px solid var(--line);color:var(--text);border-radius:8px;padding:8px 10px;cursor:pointer}
@media(max-width:760px){.nav-toggle{display:block}.nav-links{display:none;width:100%;flex-direction:column;align-items:stretch}.nav-links.open{display:flex}.nav{flex-wrap:wrap}}
.hero{position:relative;min-height:min(92vh,920px);display:flex;align-items:center;overflow:hidden;isolation:isolate}
.hero-bg{position:absolute;inset:0;background-image:url(${ASSET_BG});background-size:cover;background-position:center 35%;filter:blur(2.5px) saturate(1.08);transform:scale(1.03);z-index:-2}
.hero-veil{position:absolute;inset:0;z-index:-1;background:
  radial-gradient(ellipse 70% 55% at 72% 38%, rgba(8,12,28,.28), transparent 58%),
  linear-gradient(180deg, rgba(5,8,16,.5) 0%, rgba(5,8,16,.7) 42%, rgba(5,8,16,.94) 100%),
  linear-gradient(90deg, rgba(5,8,16,.78) 0%, rgba(5,8,16,.32) 48%, rgba(5,8,16,.7) 100%)}
.hero-inner{max-width:1100px;margin:0 auto;padding:48px 18px 64px;display:grid;grid-template-columns:1.05fr .95fr;gap:28px;align-items:center;width:100%}
@media(max-width:860px){.hero-inner{grid-template-columns:1fr;text-align:center}.hero-copy{order:2}.hero-logo-wrap{order:1;margin:0 auto}}
.eyebrow{display:inline-block;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--cyan);border:1px solid rgba(34,211,238,.3);background:rgba(34,211,238,.08);padding:6px 12px;border-radius:999px;margin-bottom:14px}
.hero h1{font-size:clamp(1.75rem,4.2vw,2.85rem);line-height:1.2;margin:0 0 12px;letter-spacing:-.02em}
.hero h1 span{background:linear-gradient(90deg,var(--amber),#f472b6,var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent}
.hero-lead{color:var(--muted);font-size:1.05rem;max-width:36rem;margin:0 0 22px}
.hero-actions{display:flex;flex-wrap:wrap;gap:10px}
@media(max-width:860px){.hero-actions{justify-content:center}.hero-lead{margin-left:auto;margin-right:auto}}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 18px;border-radius:12px;border:0;font-weight:700;font-size:.95rem;cursor:pointer;text-decoration:none;color:#fff;transition:transform .15s ease}
.btn:hover{transform:translateY(-1px);text-decoration:none}
.btn-primary{background:linear-gradient(135deg,#7c3aed,#2563eb);box-shadow:0 8px 28px rgba(124,58,237,.35)}
.btn-secondary{background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--text)}
.btn-ghost{background:transparent;border:1px solid var(--line);color:var(--text)}
.btn-danger{background:#3f1d1d;border:1px solid #7f1d1d;color:#fecaca}
.status-pill{display:inline-flex;align-items:center;gap:8px;margin-top:16px;font-size:.82rem;color:var(--muted)}
.status-pill i{width:8px;height:8px;border-radius:50%;background:var(--amber);box-shadow:0 0 10px var(--amber)}
.hero-logo-wrap{position:relative;display:flex;justify-content:center}
.hero-logo{width:min(380px,85vw);filter:drop-shadow(0 0 28px rgba(34,211,238,.28)) drop-shadow(0 0 48px rgba(245,158,11,.18));animation:float 7s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@media(prefers-reduced-motion:reduce){.hero-logo{animation:none}}
.section{padding:72px 18px;max-width:1100px;margin:0 auto}
.section-head{text-align:center;margin-bottom:36px}
.section-head h2{margin:0 0 8px;font-size:clamp(1.4rem,3vw,1.9rem)}
.section-head p{margin:0 auto;color:var(--muted);max-width:36rem}
.glass{background:var(--card);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow)}
.feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media(max-width:900px){.feat-grid{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.feat-grid{grid-template-columns:1fr}}
.feat{padding:20px 18px;transition:border-color .2s}
.feat:hover{border-color:rgba(34,211,238,.35)}
.feat-icon{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(34,211,238,.1);color:var(--cyan);font-size:1.1rem;margin-bottom:12px}
.feat h3{margin:0 0 6px;font-size:1.05rem}.feat p{margin:0;color:var(--muted);font-size:.9rem}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media(max-width:760px){.steps{grid-template-columns:1fr}}
.step{padding:22px 18px}.step-num{font-size:.75rem;letter-spacing:.1em;color:var(--amber);margin-bottom:8px}
.step h3{margin:0 0 6px;font-size:1.05rem}.step p{margin:0;color:var(--muted);font-size:.9rem}
.install-section{padding:72px 18px;background:linear-gradient(180deg,transparent,rgba(15,20,40,.5))}
.install-wrap{max-width:720px;margin:0 auto}
.card{padding:22px 20px;margin-bottom:14px}.card h3{margin:0 0 8px;font-size:1.05rem}
.hint{color:var(--muted);font-size:.85rem;margin:0 0 12px}
.row{display:flex;flex-wrap:wrap;gap:8px}
.chk{display:flex;align-items:center;gap:8px;background:rgba(24,34,52,.9);border:1px solid var(--line);border-radius:999px;padding:8px 12px;font-size:.9rem;cursor:pointer;user-select:none}
.chk.premium{border-color:rgba(167,139,250,.35)}.chk input{accent-color:var(--violet)}
label.field{display:block;margin:12px 0 4px;font-size:.86rem;color:#b7c5dc}
input[type=text],input[type=password]{width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--line);background:#0a101c;color:var(--text);font-size:.92rem}
input:focus{outline:2px solid rgba(124,58,237,.55);outline-offset:1px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:560px){.grid2{grid-template-columns:1fr}}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.flash{padding:12px 14px;border-radius:12px;margin-bottom:14px;font-size:.92rem}
.flash.ok{background:#0c2a22;border:1px solid #147a55;color:#a7f3d0}
.flash.err{background:#2a1212;border:1px solid #9b1c1c;color:#fecaca}
.install-box{margin:0 0 16px;padding:16px;border-radius:14px;background:#14102a;border:1px solid #3b2a6b}
.install-title{margin:0 0 10px;font-weight:700}
.install-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
.mono{display:block;font-size:.75rem;color:var(--muted);word-break:break-all}
.doc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:640px){.doc-grid{grid-template-columns:1fr}}
.doc{padding:16px 18px}.doc h3{margin:0 0 6px;font-size:1rem}.doc p{margin:0;color:var(--muted);font-size:.88rem}
.status-bar{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:18px}
.badge{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid var(--line);font-size:.8rem;color:var(--muted)}
.badge strong{color:var(--text);font-weight:600}
.footer{border-top:1px solid var(--line);padding:28px 18px 40px;margin-top:20px;background:#060a12}
.footer-inner{max-width:1100px;margin:0 auto;display:flex;flex-wrap:wrap;gap:18px;justify-content:space-between;align-items:flex-start}
.footer-brand{display:flex;gap:12px;align-items:center;max-width:28rem}
.footer-brand img{width:40px;height:40px;border-radius:8px}
.footer-brand p{margin:4px 0 0;color:var(--muted);font-size:.85rem}
.footer-links{display:flex;flex-wrap:wrap;gap:12px}
.footer-links a{color:var(--muted);font-size:.88rem}
.footer-meta{width:100%;margin-top:16px;color:#64748b;font-size:.78rem;text-align:center}
</style>
</head>
<body>
<header class="site-header">
  <nav class="nav" aria-label="اصلی">
    <a class="nav-brand" href="#top"><img src="${ASSET_MARK}" width="36" height="36" alt=""/>CinemaGraphy NEXT</a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-links">منو</button>
    <div class="nav-links" id="nav-links">
      <a href="#top">خانه</a>
      <a href="#features">ویژگی‌ها</a>
      <a href="#how">نحوه کار</a>
      <a href="#install">نصب / پیکربندی</a>
      <a href="#docs">راهنما</a>
      <a href="https://github.com/TheNerdCow/CinemaGraphy-next" target="_blank" rel="noopener">GitHub</a>
      <a class="nav-cta" href="#install">شروع کنید</a>
    </div>
  </nav>
</header>
<main id="top">
  <section class="hero" aria-label="Hero">
    <div class="hero-bg" role="img" aria-label="CinemaGraphy NEXT cinematic background"></div>
    <div class="hero-veil"></div>
    <div class="hero-inner">
      <div class="hero-copy">
        <span class="eyebrow">THE NEXT GENERATION OF CONTENT DISCOVERY</span>
        <h1>سرگرمی شما.<br/><span>دوباره تصور شده.</span></h1>
        <p class="hero-lead">CinemaGraphy NEXT یک بازنویسی مستقل و ماژولار است برای کشف فیلم و سریال از چند منبع، روی استریمیو — با متادیتای بدون کلید API و کانفیگ شخصی برای منابع اشتراکی.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#install">شروع نصب</a>
          <a class="btn btn-secondary" href="#features">مشاهده ویژگی‌ها</a>
        </div>
        <div class="status-pill"><i></i> نسخه ${esc(version)} · در حال توسعه فعال · مستقل از production</div>
      </div>
      <div class="hero-logo-wrap">
        <img class="hero-logo" src="${ASSET_LOGO}" width="420" height="420" alt="CinemaGraphy NEXT logo"/>
      </div>
    </div>
  </section>

  <section class="section" id="features">
    <div class="section-head"><h2>چرا NEXT؟</h2><p>طراحی شده برای چندمنبعی بودن، متادیتای مقاوم، و استقرار ساده — بدون وابستگی اجباری به کلید API.</p></div>
    <div class="feat-grid">
      <article class="glass feat"><div class="feat-icon">◎</div><h3>کشف چندمنبعی</h3><p>F2Media، Cinamatic، AslMoviez رایگان؛ Ava و Digi با کوکی نشست.</p></article>
      <article class="glass feat"><div class="feat-icon">▦</div><h3>کاتالوگ انعطاف‌پذیر</h3><p>کاتالوگ بومی هر پروایدر + جستجو با فیلتر نوع فیلم/سریال.</p></article>
      <article class="glass feat"><div class="feat-icon">◉</div><h3>متادیتا بدون کلید</h3><p>Cinemeta عمومی + پوستر MetaHub؛ پخش به موفقیت متا وابسته نیست.</p></article>
      <article class="glass feat"><div class="feat-icon">◇</div><h3>کلاینت استریمیو</h3><p>مانیفست و مسیرهای استاندارد. پروتکل استریمیو در کلاینت‌های سازگار Nuvio هم کار می‌کند.</p></article>
      <article class="glass feat"><div class="feat-icon">⬡</div><h3>استقرار منعطف</h3><p>Node محلی الان آماده است. Cloudflare Workers و Docker/VPS در نقشه راه.</p></article>
      <article class="glass feat"><div class="feat-icon">▣</div><h3>معماری تمیز</h3><p>بازنویسی clean-room؛ جدا از production فعلی تا تست بدون ریسک ممکن باشد.</p></article>
    </div>
  </section>

  <section class="section" id="how">
    <div class="section-head"><h2>چطور کار می‌کند؟</h2><p>سه قدم تا کاتالوگ‌ها در استریمیو.</p></div>
    <div class="steps">
      <div class="glass step"><div class="step-num">گام ۱</div><h3>کلاینت را انتخاب کنید</h3><p>استریمیو دسکتاپ یا موبایل (و کلاینت‌های سازگار با پروتکل استریمیو).</p></div>
      <div class="glass step"><div class="step-num">گام ۲</div><h3>مانیفست بسازید</h3><p>منابع را انتخاب کنید؛ برای Ava/Digi کوکی را وارد کنید و مانیفست شخصی بگیرید.</p></div>
      <div class="glass step"><div class="step-num">گام ۳</div><h3>کاتالوگ را باز کنید</h3><p>با دکمه نصب یا لینک مانیفست، افزونه را اضافه کنید و محتوا را مرور کنید.</p></div>
    </div>
  </section>

  <section class="install-section" id="install">
    <div class="install-wrap">
      <div class="section-head"><h2>نصب و پیکربندی</h2><p>منابع رایگان بدون کوکی. برای Ava و Digi کوکی نشست مرورگر (مثلاً PHPSESSID) لازم است.</p></div>
      ${flashHtml}
      ${installResult}
      <form method="post" action="/configure">
        <div class="glass card">
          <h3>منابع رایگان</h3>
          <p class="hint">بدون ورود کار می‌کنند. حداقل یکی را روشن بگذارید.</p>
          <div class="row">
            <label class="chk"><input type="checkbox" name="providers" value="f2media"${sel('f2media')}/> F2Media</label>
            <label class="chk"><input type="checkbox" name="providers" value="cinamatic"${sel('cinamatic')}/> Cinamatic</label>
            <label class="chk"><input type="checkbox" name="providers" value="aslmoviez"${sel('aslmoviez')}/> AslMoviez</label>
          </div>
        </div>
        <div class="glass card">
          <h3>منابع اشتراکی</h3>
          <p class="hint">کوکی را از DevTools مرورگر کپی کنید. baseUrl اختیاری است.</p>
          <div class="row" style="margin-bottom:8px">
            <label class="chk premium"><input type="checkbox" name="providers" value="avamovie"${sel('avamovie')}/> AvaMovie</label>
            <label class="chk premium"><input type="checkbox" name="providers" value="digimovie"${sel('digimovie')}/> DigiMovie</label>
          </div>
          <div class="grid2">
            <div>
              <label class="field">کوکی Ava</label>
              <input type="password" name="avaCookie" value="${esc(cookieValue)}" autocomplete="off" placeholder="PHPSESSID=..."/>
              <label class="field">Ava baseUrl</label>
              <input type="text" name="avaBaseUrl" value="${esc(avaBaseUrl)}" dir="ltr" placeholder="https://..."/>
            </div>
            <div>
              <label class="field">کوکی Digi</label>
              <input type="password" name="digiCookie" value="${esc(digiCookieValue)}" autocomplete="off" placeholder="PHPSESSID=..."/>
              <label class="field">Digi baseUrl</label>
              <input type="text" name="digiBaseUrl" value="${esc(digiBaseUrl)}" dir="ltr" placeholder="https://digimoviez53.top"/>
            </div>
          </div>
        </div>
        <div class="actions">
          <button type="submit" class="btn btn-primary">ساخت مانیفست شخصی</button>
          <a class="btn btn-secondary" href="/manifest.json" dir="ltr">مانیفست عمومی</a>
        </div>
      </form>
      <form method="post" action="/session/clear" style="margin-top:12px">
        <button type="submit" class="btn btn-danger">پاک کردن نشست سرور</button>
      </form>
      <div class="status-bar">
        <span class="badge"><strong>v${esc(version)}</strong> · Node runtime</span>
        <span class="badge">Cinemeta · بدون کلید API</span>
        <span class="badge">Stremio protocol</span>
      </div>
    </div>
  </section>

  <section class="section" id="docs">
    <div class="section-head"><h2>راهنما و عیب‌یابی</h2><p>شروع سریع برای نصب و پیکربندی.</p></div>
    <div class="doc-grid">
      <article class="glass doc"><h3>نصب در استریمیو</h3><p>مانیفست عمومی یا شخصی را کپی کنید → در استریمیو Addons → Community Addons → Install from URL.</p></article>
      <article class="glass doc"><h3>کوکی منابع اشتراکی</h3><p>بعد از لاگین در سایت منبع، از DevTools → Application → Cookies مقدار PHPSESSID (یا session) را کپی کنید. بدون کوکی معتبر، کاتالوگ‌های اشتراکی فعال نمی‌شوند.</p></article>
      <article class="glass doc"><h3>کاتالوگ‌ها</h3><p>هر پروایدر کاتالوگ فیلم/سریال خود را دارد. جستجو بر اساس نوع کاتالوگ فیلتر می‌شود.</p></article>
      <article class="glass doc"><h3>عیب‌یابی</h3><p><span dir="ltr">/health</span> را چک کنید. اگر کاتالوگ خالی است کوکی و baseUrl را بررسی کنید. سرور را بعد از تغییر کد ری‌استارت کنید.</p></article>
    </div>
  </section>

  <section class="section" id="status">
    <div class="section-head">
      <h2>وضعیت پروژه</h2>
      <p>بازنویسی مستقل — production فعلی CinemaGraphy دست‌نخورده می‌ماند.</p>
    </div>
    <div class="glass card" style="max-width:720px;margin:0 auto;text-align:center">
      <p class="hint" style="margin-bottom:14px">کد منبع، ایشوها و مشارکت از طریق GitHub.</p>
      <div class="actions" style="justify-content:center">
        <a class="btn btn-primary" href="https://github.com/TheNerdCow/CinemaGraphy-next" target="_blank" rel="noopener">مخزن GitHub</a>
        <a class="btn btn-secondary" href="https://github.com/TheNerdCow/CinemaGraphy-next/issues" target="_blank" rel="noopener">گزارش مشکل</a>
      </div>
    </div>
  </section>
</main>

<footer class="footer">
  <div class="footer-inner">
    <div class="footer-brand">
      <img src="${ASSET_MARK}" width="40" height="40" alt=""/>
      <div>
        <strong>CinemaGraphy NEXT</strong>
        <p>نسل بعدی کشف محتوا برای استریمیو — clean-room، ماژولار، چندمنبعی.</p>
      </div>
    </div>
    <div class="footer-links">
      <a href="#features">ویژگی‌ها</a>
      <a href="#install">نصب</a>
      <a href="#docs">راهنما</a>
      <a href="/manifest.json" dir="ltr">manifest</a>
      <a href="/health" dir="ltr">health</a>
      <a href="https://github.com/TheNerdCow/CinemaGraphy-next" target="_blank" rel="noopener">GitHub</a>
    </div>
    <div class="footer-meta">v${esc(version)} · ISC · مستقل از cmplugin.ir / CinemaGraphy production</div>
  </div>
</footer>
<script>
(function(){
  var t=document.querySelector('.nav-toggle');
  var links=document.getElementById('nav-links');
  if(t&&links){
    t.addEventListener('click',function(){
      var open=links.classList.toggle('open');
      t.setAttribute('aria-expanded', open?'true':'false');
    });
  }
  document.querySelectorAll('[data-copy]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var v=btn.getAttribute('data-copy')||'';
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(v).then(function(){btn.textContent='کپی شد';}).catch(function(){});
      }
    });
  });
})();
</script>
</body>
</html>`
}

export default renderLanding
