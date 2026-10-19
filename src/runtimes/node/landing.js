/**
 * CinemaGraphy NEXT — clean landing (cmplugin-inspired)
 * Brand: MainLogo + Hogwarts BG + app icon
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
  const version = opts.version || '0.6.4'
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
          <a class="btn btn-primary" href="stremio://${esc(stripProto(personalPath))}">نصب در استریمیو / نوویو</a>
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
<meta name="description" content="CinemaGraphy NEXT — افزونه استریمیو و نوویو برای فیلم و سریال از منابع ایرانی"/>
<link rel="icon" type="image/png" href="${ASSET_FAV}"/>
<link rel="apple-touch-icon" href="${ASSET_MARK}"/>
<style>
:root{--bg:#070a12;--surface:rgba(18,22,36,.72);--line:rgba(255,255,255,.08);--text:#f1f5f9;--muted:#94a3b8;--gold:#e8a317;--accent:#f0b429;--radius:14px;--font:Tahoma,"Segoe UI",system-ui,sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.65;min-height:100vh}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}img{max-width:100%;height:auto;display:block}
.topbar{position:sticky;top:0;z-index:40;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);background:rgba(7,10,18,.85);border-bottom:1px solid var(--line)}
.topbar-inner{max-width:1080px;margin:0 auto;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand{display:flex;align-items:center;gap:10px;color:var(--text);font-weight:700;text-decoration:none}.brand img{width:34px;height:34px;border-radius:9px}
.nav{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.nav a{color:var(--muted);padding:7px 12px;border-radius:999px;font-size:.88rem;text-decoration:none}.nav a:hover{color:var(--text);background:rgba(255,255,255,.05)}.nav .pill{background:rgba(232,163,23,.15);color:var(--gold);border:1px solid rgba(232,163,23,.35)}
.hero{position:relative;min-height:min(88vh,780px);display:flex;align-items:center;overflow:hidden;isolation:isolate}
.hero-bg{position:absolute;inset:0;background-image:url(${ASSET_BG});background-size:cover;background-position:center 40%;filter:brightness(.55) saturate(1.05);z-index:-2}
.hero-veil{position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(7,10,18,.55) 0%,rgba(7,10,18,.75) 45%,rgba(7,10,18,.96) 100%),linear-gradient(90deg,rgba(7,10,18,.7) 0%,rgba(7,10,18,.25) 55%,rgba(7,10,18,.65) 100%)}
.hero-inner{max-width:1080px;margin:0 auto;padding:40px 18px 56px;display:grid;grid-template-columns:auto 1fr;gap:36px;align-items:center;width:100%}
@media(max-width:800px){.hero-inner{grid-template-columns:1fr;text-align:center;justify-items:center}}
.logo-card{width:min(260px,70vw);aspect-ratio:1;border-radius:28px;background:rgba(12,14,24,.55);border:1px solid rgba(255,255,255,.1);padding:22px;display:grid;place-items:center;box-shadow:0 24px 60px rgba(0,0,0,.45),0 0 40px rgba(232,163,23,.08)}
.logo-card img{width:100%;filter:drop-shadow(0 8px 24px rgba(0,0,0,.35))}
.hero-copy h1{font-size:clamp(1.7rem,4vw,2.5rem);line-height:1.25;margin:0 0 10px;font-weight:800}
.hero-copy h1 .grad{background:linear-gradient(90deg,#f5c542,#f97316);-webkit-background-clip:text;background-clip:text;color:transparent}
.hero-lead{color:var(--muted);font-size:1rem;max-width:32rem;margin:0 0 20px}
.cta-row{display:flex;flex-wrap:wrap;gap:10px}@media(max-width:800px){.cta-row{justify-content:center}}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 18px;border-radius:12px;border:0;font-weight:700;font-size:.92rem;cursor:pointer;text-decoration:none;transition:transform .12s ease}
.btn:hover{transform:translateY(-1px);text-decoration:none}
.btn-primary{background:linear-gradient(180deg,#f0b429,#d4920f);color:#1a1200;box-shadow:0 6px 20px rgba(232,163,23,.3)}
.btn-secondary{background:rgba(255,255,255,.07);border:1px solid var(--line);color:var(--text)}
.btn-ghost{background:transparent;border:1px solid var(--line);color:var(--text)}
.ver{display:inline-flex;align-items:center;gap:8px;margin-top:14px;font-size:.8rem;color:var(--muted)}.ver i{width:7px;height:7px;border-radius:50%;background:var(--gold);box-shadow:0 0 8px var(--gold)}
.wrap{max-width:1080px;margin:0 auto;padding:56px 18px}.sec-head{text-align:center;margin-bottom:28px}.sec-head h2{margin:0 0 6px;font-size:1.45rem}.sec-head p{margin:0;color:var(--muted);font-size:.95rem}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}@media(max-width:900px){.grid4{grid-template-columns:1fr 1fr}}@media(max-width:520px){.grid4{grid-template-columns:1fr}}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px 16px;backdrop-filter:blur(10px)}.card h3{margin:0 0 6px;font-size:1rem}.card p{margin:0;color:var(--muted);font-size:.88rem}
.icon{width:36px;height:36px;border-radius:10px;background:rgba(232,163,23,.12);color:var(--gold);display:grid;place-items:center;font-size:1rem;margin-bottom:10px}
.clients{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:700px){.clients{grid-template-columns:1fr}}.client{padding:20px}.client h3{margin:0 0 4px}.client .sub{color:var(--muted);font-size:.85rem;margin-bottom:12px}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{display:inline-flex;padding:8px 12px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--text);font-size:.85rem;text-decoration:none}.chip:hover{border-color:rgba(232,163,23,.4);color:var(--gold);text-decoration:none}
.install-sec{background:linear-gradient(180deg,transparent,rgba(15,18,30,.6))}.form-wrap{max-width:680px;margin:0 auto}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:20px;margin-bottom:12px}.panel h3{margin:0 0 6px;font-size:1.02rem}.hint{color:var(--muted);font-size:.84rem;margin:0 0 12px}
.row{display:flex;flex-wrap:wrap;gap:8px}.chk{display:flex;align-items:center;gap:8px;background:rgba(20,24,40,.9);border:1px solid var(--line);border-radius:999px;padding:8px 12px;font-size:.88rem;cursor:pointer;user-select:none}.chk.premium{border-color:rgba(167,139,250,.3)}.chk input{accent-color:var(--gold)}
label.field{display:block;margin:12px 0 4px;font-size:.84rem;color:#b7c5dc}
input[type=text],input[type=password]{width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--line);background:#0c101c;color:var(--text);font-size:.9rem}input:focus{outline:2px solid rgba(232,163,23,.45);outline-offset:1px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:560px){.grid2{grid-template-columns:1fr}}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
.flash{padding:12px 14px;border-radius:12px;margin-bottom:12px;font-size:.9rem}.flash.ok{background:#0c2a22;border:1px solid #147a55;color:#a7f3d0}.flash.err{background:#2a1212;border:1px solid #9b1c1c;color:#fecaca}
.install-box{margin:0 0 14px;padding:16px;border-radius:14px;background:#1a1528;border:1px solid #3b2a6b}.install-title{margin:0 0 10px;font-weight:700}.install-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}.mono{display:block;font-size:.72rem;color:var(--muted);word-break:break-all}
.footer{border-top:1px solid var(--line);padding:28px 18px 40px;margin-top:12px;background:#05070e}
.footer-inner{max-width:1080px;margin:0 auto;display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;align-items:flex-start}
.footer-brand{display:flex;gap:12px;align-items:center;max-width:26rem}.footer-brand img{width:38px;height:38px;border-radius:10px}.footer-brand p{margin:4px 0 0;color:var(--muted);font-size:.84rem}
.footer-links{display:flex;flex-wrap:wrap;gap:12px}.footer-links a{color:var(--muted);font-size:.86rem}.footer-meta{width:100%;margin-top:14px;color:#64748b;font-size:.76rem;text-align:center}
</style>
</head>
<body>
<header class="topbar"><div class="topbar-inner">
<a class="brand" href="#top"><img src="${ASSET_MARK}" width="34" height="34" alt=""/>CinemaGraphy NEXT</a>
<nav class="nav" aria-label="اصلی">
<a href="#features">ویژگی‌ها</a><a href="#clients">دانلود کلاینت</a><a href="#install">نصب</a><a class="pill" href="#install">شروع</a>
</nav></div></header>
<main id="top">
<section class="hero" aria-label="Hero">
<div class="hero-bg" role="img" aria-label="background"></div><div class="hero-veil"></div>
<div class="hero-inner">
<div class="logo-card"><img src="${ASSET_LOGO}" width="220" height="220" alt="CinemaGraphy NEXT"/></div>
<div class="hero-copy">
<h1>سینماگرافی <span class="grad">NEXT</span><br/>فیلم، سریال، انیمه</h1>
<p class="hero-lead">افزونه استریمیو و نوویو برای تماشای فیلم و سریال از منابع ایرانی — با کانفیگ شخصی و مانیفست اختصاصی.</p>
<div class="cta-row">
<a class="btn btn-primary" href="#install">نصب در نوویو و استریمیو</a>
<a class="btn btn-secondary" href="#clients">دانلود کلاینت</a>
<a class="btn btn-ghost" href="#install">شخصی‌سازی</a>
</div>
<div class="ver"><i></i> v${esc(version)} · بازنویسی مستقل · فعال</div>
</div></div></section>
<section class="wrap" id="features">
<div class="sec-head"><h2>چرا NEXT؟</h2><p>چندمنبعی، بدون کلید API اجباری، نصب ساده روی استریمیو و نوویو.</p></div>
<div class="grid4">
<article class="card"><div class="icon">◎</div><h3>منابع ایرانی</h3><p>F2Media، Cinamatic، AslMoviez رایگان؛ Ava و Digi با کوکی.</p></article>
<article class="card"><div class="icon">▦</div><h3>کاتالوگ تمیز</h3><p>جستجو و مرور با فیلتر فیلم/سریال؛ بدون نویز سایدبار.</p></article>
<article class="card"><div class="icon">◉</div><h3>متا بدون کلید</h3><p>Cinemeta عمومی + پوستر؛ پخش وابسته به موفقیت متا نیست.</p></article>
<article class="card"><div class="icon">◇</div><h3>استریمیو + نوویو</h3><p>مانیفست استاندارد؛ روی هر دو کلاینت کار می‌کند.</p></article>
</div></section>
<section class="wrap" id="clients">
<div class="sec-head"><h2>دانلود کلاینت</h2><p>سینماگرافی روی Stremio و Nuvio کار می‌کند. هر دو را می‌توانید نصب کنید.</p></div>
<div class="clients">
<div class="card client"><h3>Stremio</h3><p class="sub">کلاسیک و پایدار — همه پلتفرم‌ها</p>
<div class="chips">
<a class="chip" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">Windows / macOS / Linux</a>
<a class="chip" href="https://www.stremio.com/downloads" target="_blank" rel="noopener">Android</a>
<a class="chip" href="https://apps.apple.com/app/stremio/id1297124690" target="_blank" rel="noopener">iOS / tvOS</a>
<a class="chip" href="https://web.stremio.com/" target="_blank" rel="noopener">وب‌اپ</a>
</div></div>
<div class="card client"><h3>Nuvio</h3><p class="sub">سازگار با مانیفست استریمیو</p>
<div class="chips">
<a class="chip" href="https://nuvio.tv/" target="_blank" rel="noopener">سایت رسمی</a>
<a class="chip" href="https://play.google.com/store/apps/details?id=com.nuvio.app" target="_blank" rel="noopener">Play Store</a>
<a class="chip" href="https://github.com/NuvioMedia/NuvioMobile/releases/latest" target="_blank" rel="noopener">Android APK</a>
<a class="chip" href="https://github.com/NuvioMedia/NuvioDesktop/releases/latest" target="_blank" rel="noopener">Desktop</a>
<a class="chip" href="https://testflight.apple.com/join/u4y7MHK9" target="_blank" rel="noopener">iOS TestFlight</a>
</div></div></div></section>
<section class="install-sec wrap" id="install">
<div class="form-wrap">
<div class="sec-head"><h2>نصب و پیکربندی</h2><p>منابع رایگان بدون کوکی. برای Ava و Digi کوکی نشست مرورگر لازم است.</p></div>
${flashHtml}${installResult}
<form method="post" action="/configure">
<div class="panel"><h3>منابع رایگان</h3><p class="hint">بدون ورود کار می‌کنند. حداقل یکی را روشن بگذارید.</p>
<div class="row">
<label class="chk"><input type="checkbox" name="providers" value="f2media"${sel('f2media')}/> F2Media</label>
<label class="chk"><input type="checkbox" name="providers" value="cinamatic"${sel('cinamatic')}/> Cinamatic</label>
<label class="chk"><input type="checkbox" name="providers" value="aslmoviez"${sel('aslmoviez')}/> AslMoviez</label>
</div></div>
<div class="panel"><h3>منابع اشتراکی</h3><p class="hint">کوکی را از DevTools مرورگر کپی کنید. baseUrl اختیاری است.</p>
<div class="row" style="margin-bottom:8px">
<label class="chk premium"><input type="checkbox" name="providers" value="avamovie"${sel('avamovie')}/> AvaMovie</label>
<label class="chk premium"><input type="checkbox" name="providers" value="digimovie"${sel('digimovie')}/> DigiMovie</label>
</div>
<div class="grid2"><div>
<label class="field">کوکی Ava</label>
<input type="password" name="avaCookie" value="${esc(cookieValue)}" autocomplete="off" placeholder="PHPSESSID=..."/>
<label class="field">Ava baseUrl</label>
<input type="text" name="avaBaseUrl" value="${esc(avaBaseUrl)}" dir="ltr" placeholder="https://..."/>
</div><div>
<label class="field">کوکی Digi</label>
<input type="password" name="digiCookie" value="${esc(digiCookieValue)}" autocomplete="off" placeholder="PHPSESSID=..."/>
<label class="field">Digi baseUrl</label>
<input type="text" name="digiBaseUrl" value="${esc(digiBaseUrl)}" dir="ltr" placeholder="https://digimoviez53.top"/>
</div></div></div>
<div class="actions">
<button type="submit" class="btn btn-primary">ساخت مانیفست شخصی</button>
<a class="btn btn-secondary" href="/manifest.json" dir="ltr">مانیفست عمومی</a>
</div></form>
<form method="post" action="/session/clear" style="margin-top:12px">
<button type="submit" class="btn btn-ghost">پاک کردن نشست سرور</button>
</form></div></section>
</main>
<footer class="footer"><div class="footer-inner">
<div class="footer-brand"><img src="${ASSET_MARK}" width="38" height="38" alt=""/><div><strong>CinemaGraphy NEXT</strong><p>بازنویسی مستقل و ماژولار — جدا از production فعلی.</p></div></div>
<div class="footer-links">
<a href="#features">ویژگی‌ها</a><a href="#clients">کلاینت‌ها</a><a href="#install">نصب</a>
<a href="/manifest.json" dir="ltr">manifest</a><a href="/health" dir="ltr">health</a>
<a href="https://github.com/TheNerdCow/CinemaGraphy-next" target="_blank" rel="noopener">GitHub</a>
</div>
<div class="footer-meta">v${esc(version)} · ISC · مستقل از cmplugin.ir</div>
</div></footer>
<script>(function(){document.querySelectorAll('[data-copy]').forEach(function(btn){btn.addEventListener('click',function(){var v=btn.getAttribute('data-copy')||'';if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(v).then(function(){btn.textContent='کپی شد';}).catch(function(){});}});});})();</script>
</body></html>`
}
export default renderLanding
