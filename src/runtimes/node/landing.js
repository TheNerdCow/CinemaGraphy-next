/**
 * CinemaGraphy NEXT — landing (clean, subtle neon, cmplugin-level polish)
 * Assets served statically from /assets/
 */
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
  const version = opts.version || '0.6.5'
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
    ? `<div class=\"flash ${flash.ok ? 'ok' : 'err'}\" role=\"status\">${esc(flash.msg)}</div>`
    : ''

  const installResult = personalPath
    ? `<div class=\"install-box\">
        <p class=\"install-title\">مانیفست شخصی آماده است</p>
        <div class=\"install-actions\">
          <a class=\"btn btn-gold\" href=\"stremio://${esc(stripProto(personalPath))}\">نصب در استریمیو / نوویو</a>
          <button type=\"button\" class=\"btn btn-ghost\" data-copy=\"${esc(personalPath)}\">کپی لینک</button>
        </div>
        <code class=\"mono\" dir=\"ltr\">${esc(personalPath)}</code>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang=\"fa\" dir=\"rtl\">
<head>
<meta charset=\"utf-8\"/>
<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>
<title>CinemaGraphy NEXT</title>
<meta name=\"description\" content=\"افزونه استریمیو و نوویو — فیلم و سریال از منابع ایرانی\"/>
<link rel=\"icon\" type=\"image/png\" href=\"/assets/fav.png\"/>
<link rel=\"apple-touch-icon\" href=\"/assets/mark.png\"/>
<style>
:root{
  --bg:#06080f;
  --panel:rgba(14,18,32,.78);
  --line:rgba(255,255,255,.09);
  --text:#eef2f7;
  --muted:#8b97ab;
  --gold:#e8b923;
  --gold-dim:rgba(232,185,35,.14);
  --neon:0 0 24px rgba(232,185,35,.22);
  --radius:16px;
  --font:Tahoma,\"Segoe UI\",system-ui,sans-serif;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.65;min-height:100vh}
a{color:var(--gold);text-decoration:none}
a:hover{text-decoration:underline}
img{max-width:100%;height:auto;display:block}
.topbar{position:sticky;top:0;z-index:50;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);background:rgba(6,8,15,.82);border-bottom:1px solid var(--line)}
.topbar-inner{max-width:1040px;margin:0 auto;padding:11px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand{display:flex;align-items:center;gap:10px;color:var(--text);font-weight:700;text-decoration:none;letter-spacing:-.01em}
.brand img{width:32px;height:32px;border-radius:8px;box-shadow:var(--neon)}
.nav{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.nav a{color:var(--muted);padding:6px 12px;border-radius:999px;font-size:.86rem;text-decoration:none}
.nav a:hover{color:var(--text);background:rgba(255,255,255,.05)}
.nav .cta{background:var(--gold-dim);color:var(--gold);border:1px solid rgba(232,185,35,.35)}
.hero{position:relative;min-height:min(82vh,720px);display:flex;align-items:center;overflow:hidden;isolation:isolate}
.hero-bg{position:absolute;inset:0;background:url(/assets/bg.jpg) center 38%/cover no-repeat;filter:brightness(.48) saturate(1.08) contrast(1.05);z-index:-2}
.hero-veil{position:absolute;inset:0;z-index:-1;background:
  linear-gradient(180deg,rgba(6,8,15,.5) 0%,rgba(6,8,15,.72) 50%,rgba(6,8,15,.97) 100%),
  linear-gradient(105deg,rgba(6,8,15,.75) 0%,rgba(6,8,15,.2) 50%,rgba(6,8,15,.7) 100%)}
.hero-inner{max-width:1040px;margin:0 auto;padding:48px 18px 64px;display:grid;grid-template-columns:240px 1fr;gap:40px;align-items:center;width:100%}
@media(max-width:820px){.hero-inner{grid-template-columns:1fr;text-align:center;justify-items:center;gap:28px}}
.logo-wrap{width:min(240px,68vw);aspect-ratio:1;border-radius:26px;background:rgba(10,12,22,.55);border:1px solid rgba(255,255,255,.1);padding:20px;display:grid;place-items:center;box-shadow:0 20px 50px rgba(0,0,0,.5),0 0 48px rgba(232,185,35,.1)}
.logo-wrap img{width:100%;filter:drop-shadow(0 6px 20px rgba(0,0,0,.4))}
.hero-copy h1{font-size:clamp(1.75rem,4.2vw,2.55rem);line-height:1.22;margin:0 0 12px;font-weight:800;letter-spacing:-.02em}
.hero-copy h1 em{font-style:normal;color:var(--gold);text-shadow:0 0 28px rgba(232,185,35,.35)}
.hero-lead{color:var(--muted);font-size:.98rem;max-width:30rem;margin:0 0 22px}
.cta-row{display:flex;flex-wrap:wrap;gap:10px}
@media(max-width:820px){.cta-row{justify-content:center}}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 20px;border-radius:12px;border:0;font-weight:700;font-size:.92rem;cursor:pointer;text-decoration:none;transition:transform .12s ease,box-shadow .12s ease}
.btn:hover{transform:translateY(-1px);text-decoration:none}
.btn-gold{background:linear-gradient(180deg,#f0c040,#d4a016);color:#1a1200;box-shadow:0 6px 22px rgba(232,185,35,.32)}
.btn-gold:hover{box-shadow:0 8px 28px rgba(232,185,35,.42)}
.btn-line{background:transparent;border:1px solid var(--line);color:var(--text)}
.btn-line:hover{border-color:rgba(232,185,35,.4);color:var(--gold)}
.btn-ghost{background:transparent;border:1px solid var(--line);color:var(--muted);font-weight:600}
.meta-line{margin-top:16px;font-size:.8rem;color:var(--muted);display:flex;align-items:center;gap:8px}
@media(max-width:820px){.meta-line{justify-content:center}}
.meta-line i{width:6px;height:6px;border-radius:50%;background:var(--gold);box-shadow:0 0 10px var(--gold)}
.wrap{max-width:1040px;margin:0 auto;padding:52px 18px}
.sec-head{margin-bottom:24px}
.sec-head h2{margin:0 0 6px;font-size:1.35rem;font-weight:800}
.sec-head p{margin:0;color:var(--muted);font-size:.92rem}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
@media(max-width:760px){.grid3{grid-template-columns:1fr}}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px 16px;backdrop-filter:blur(12px)}
.card h3{margin:0 0 6px;font-size:.98rem}
.card p{margin:0;color:var(--muted);font-size:.86rem}
.clients{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:700px){.clients{grid-template-columns:1fr}}
.client h3{margin:0 0 2px;font-size:1.05rem}
.client .sub{color:var(--muted);font-size:.82rem;margin:0 0 12px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:inline-flex;padding:8px 13px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid var(--line);color:var(--text);font-size:.84rem;text-decoration:none;transition:border-color .12s,color .12s}
.chip:hover{border-color:rgba(232,185,35,.45);color:var(--gold);text-decoration:none}
.install-sec{padding-bottom:64px}
.form-wrap{max-width:640px;margin:0 auto}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px;margin-bottom:12px;backdrop-filter:blur(12px)}
.panel h3{margin:0 0 4px;font-size:1rem}
.hint{color:var(--muted);font-size:.82rem;margin:0 0 12px}
.row{display:flex;flex-wrap:wrap;gap:8px}
.chk{display:flex;align-items:center;gap:8px;background:rgba(12,16,28,.9);border:1px solid var(--line);border-radius:999px;padding:8px 13px;font-size:.86rem;cursor:pointer;user-select:none}
.chk.premium{border-color:rgba(167,139,250,.28)}
.chk input{accent-color:var(--gold)}
label.field{display:block;margin:12px 0 4px;font-size:.82rem;color:#a8b4c8}
input[type=text],input[type=password]{width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--line);background:#0a0e18;color:var(--text);font-size:.9rem}
input:focus{outline:2px solid rgba(232,185,35,.4);outline-offset:1px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:560px){.grid2{grid-template-columns:1fr}}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;align-items:center}
.actions .linkish{color:var(--muted);font-size:.86rem;margin-inline-start:4px}
.flash{padding:12px 14px;border-radius:12px;margin-bottom:12px;font-size:.9rem}
.flash.ok{background:#0b241c;border:1px solid #156b4c;color:#a7f3d0}
.flash.err{background:#2a1212;border:1px solid #9b1c1c;color:#fecaca}
.install-box{margin:0 0 14px;padding:16px;border-radius:14px;background:rgba(22,18,40,.85);border:1px solid rgba(120,90,200,.35)}
.install-title{margin:0 0 10px;font-weight:700}
.install-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
.mono{display:block;font-size:.72rem;color:var(--muted);word-break:break-all}
.footer{border-top:1px solid var(--line);padding:26px 18px 36px;background:#04060c}
.footer-inner{max-width:1040px;margin:0 auto;display:flex;flex-wrap:wrap;gap:14px;justify-content:space-between;align-items:center}
.footer-brand{display:flex;gap:10px;align-items:center;color:var(--muted);font-size:.86rem}
.footer-brand img{width:30px;height:30px;border-radius:8px}
.footer-links{display:flex;flex-wrap:wrap;gap:14px}
.footer-links a{color:var(--muted);font-size:.84rem}
.footer-meta{width:100%;margin-top:10px;color:#4a5568;font-size:.74rem;text-align:center}
</style>
</head>
<body>
<header class=\"topbar\">
  <div class=\"topbar-inner\">
    <a class=\"brand\" href=\"#top\"><img src=\"/assets/mark.png\" width=\"32\" height=\"32\" alt=\"\"/>CinemaGraphy NEXT</a>
    <nav class=\"nav\" aria-label=\"اصلی\">
      <a href=\"#clients\">دانلود</a>
      <a href=\"#install\">نصب</a>
      <a class=\"cta\" href=\"#install\">شروع</a>
    </nav>
  </div>
</header>

<main id=\"top\">
<section class=\"hero\" aria-label=\"Hero\">
  <div class=\"hero-bg\" role=\"img\" aria-label=\"background\"></div>
  <div class=\"hero-veil\"></div>
  <div class=\"hero-inner\">
    <div class=\"logo-wrap\"><img src=\"/assets/logo.webp\" width=\"200\" height=\"200\" alt=\"CinemaGraphy NEXT\"/></div>
    <div class=\"hero-copy\">
      <h1>سینماگرافی <em>NEXT</em></h1>
      <p class=\"hero-lead\">افزونه استریمیو و نوویو برای تماشای فیلم و سریال از منابع ایرانی — با مانیفست شخصی.</p>
      <div class=\"cta-row\">
        <a class=\"btn btn-gold\" href=\"#install\">نصب افزونه</a>
        <a class=\"btn btn-line\" href=\"#clients\">دانلود کلاینت</a>
      </div>
      <div class=\"meta-line\"><i></i> v${esc(version)} · فعال</div>
    </div>
  </div>
</section>

<section class=\"wrap\" id=\"features\">
  <div class=\"sec-head\">
    <h2>چیزی که مهم است</h2>
    <p>منابع ایرانی، کاتالوگ تمیز، نصب روی استریمیو و نوویو.</p>
  </div>
  <div class=\"grid3\">
    <article class=\"card\"><h3>چندمنبعی</h3><p>F2، Cinamatic و Asl رایگان؛ Ava و Digi با کوکی نشست.</p></article>
    <article class=\"card\"><h3>بدون کلید اجباری</h3><p>متا از Cinemeta عمومی. پخش وابسته به موفقیت متا نیست.</p></article>
    <article class=\"card\"><h3>مانیفست شخصی</h3><p>فقط منابعی که می‌خواهی؛ لینک یک‌باره برای استریمیو / نوویو.</p></article>
  </div>
</section>

<section class=\"wrap\" id=\"clients\">
  <div class=\"sec-head\">
    <h2>دانلود کلاینت</h2>
    <p>اول کلاینت را نصب کن، بعد مانیفست را اضافه کن.</p>
  </div>
  <div class=\"clients\">
    <div class=\"card client\">
      <h3>Stremio</h3>
      <p class=\"sub\">پایدار — همه پلتفرم‌ها</p>
      <div class=\"chips\">
        <a class=\"chip\" href=\"https://www.stremio.com/downloads\" target=\"_blank\" rel=\"noopener\">ویندوز / مک / لینوکس</a>
        <a class=\"chip\" href=\"https://www.stremio.com/downloads\" target=\"_blank\" rel=\"noopener\">اندروید</a>
        <a class=\"chip\" href=\"https://apps.apple.com/app/stremio/id1297124690\" target=\"_blank\" rel=\"noopener\">iOS</a>
        <a class=\"chip\" href=\"https://web.stremio.com/\" target=\"_blank\" rel=\"noopener\">وب</a>
      </div>
    </div>
    <div class=\"card client\">
      <h3>Nuvio</h3>
      <p class=\"sub\">سازگار با مانیفست استریمیو</p>
      <div class=\"chips\">
        <a class=\"chip\" href=\"https://nuvio.tv/\" target=\"_blank\" rel=\"noopener\">سایت</a>
        <a class=\"chip\" href=\"https://play.google.com/store/apps/details?id=com.nuvio.app\" target=\"_blank\" rel=\"noopener\">Play Store</a>
        <a class=\"chip\" href=\"https://github.com/NuvioMedia/NuvioMobile/releases/latest\" target=\"_blank\" rel=\"noopener\">APK</a>
        <a class=\"chip\" href=\"https://github.com/NuvioMedia/NuvioDesktop/releases/latest\" target=\"_blank\" rel=\"noopener\">دسکتاپ</a>
        <a class=\"chip\" href=\"https://testflight.apple.com/join/u4y7MHK9\" target=\"_blank\" rel=\"noopener\">TestFlight</a>
      </div>
    </div>
  </div>
</section>

<section class=\"install-sec wrap\" id=\"install\">
  <div class=\"form-wrap\">
    <div class=\"sec-head\">
      <h2>نصب</h2>
      <p>منابع رایگان بدون کوکی. برای Ava / Digi کوکی مرورگر لازم است.</p>
    </div>
    ${flashHtml}${installResult}
    <form method=\"post\" action=\"/configure\">
      <div class=\"panel\">
        <h3>منابع رایگان</h3>
        <p class=\"hint\">حداقل یکی را روشن بگذار.</p>
        <div class=\"row\">
          <label class=\"chk\"><input type=\"checkbox\" name=\"providers\" value=\"f2media\"${sel('f2media')}/> F2Media</label>
          <label class=\"chk\"><input type=\"checkbox\" name=\"providers\" value=\"cinamatic\"${sel('cinamatic')}/> Cinamatic</label>
          <label class=\"chk\"><input type=\"checkbox\" name=\"providers\" value=\"aslmoviez\"${sel('aslmoviez')}/> AslMoviez</label>
        </div>
      </div>
      <div class=\"panel\">
        <h3>منابع اشتراکی</h3>
        <p class=\"hint\">کوکی را از DevTools کپی کن. baseUrl اختیاری است.</p>
        <div class=\"row\" style=\"margin-bottom:8px\">
          <label class=\"chk premium\"><input type=\"checkbox\" name=\"providers\" value=\"avamovie\"${sel('avamovie')}/> AvaMovie</label>
          <label class=\"chk premium\"><input type=\"checkbox\" name=\"providers\" value=\"digimovie\"${sel('digimovie')}/> DigiMovie</label>
        </div>
        <div class=\"grid2\">
          <div>
            <label class=\"field\">کوکی Ava</label>
            <input type=\"password\" name=\"avaCookie\" value=\"${esc(cookieValue)}\" autocomplete=\"off\" placeholder=\"PHPSESSID=...\"/>
            <label class=\"field\">Ava baseUrl</label>
            <input type=\"text\" name=\"avaBaseUrl\" value=\"${esc(avaBaseUrl)}\" dir=\"ltr\" placeholder=\"https://...\"/>
          </div>
          <div>
            <label class=\"field\">کوکی Digi</label>
            <input type=\"password\" name=\"digiCookie\" value=\"${esc(digiCookieValue)}\" autocomplete=\"off\" placeholder=\"PHPSESSID=...\"/>
            <label class=\"field\">Digi baseUrl</label>
            <input type=\"text\" name=\"digiBaseUrl\" value=\"${esc(digiBaseUrl)}\" dir=\"ltr\" placeholder=\"https://digimoviez53.top\"/>
          </div>
        </div>
      </div>
      <div class=\"actions\">
        <button type=\"submit\" class=\"btn btn-gold\">ساخت مانیفست شخصی</button>
        <a class=\"linkish\" href=\"/manifest.json\" dir=\"ltr\">مانیفست عمومی</a>
      </div>
    </form>
    <form method=\"post\" action=\"/session/clear\" style=\"margin-top:14px\">
      <button type=\"submit\" class=\"btn btn-ghost\">پاک کردن نشست سرور</button>
    </form>
  </div>
</section>
</main>

<footer class=\"footer\">
  <div class=\"footer-inner\">
    <div class=\"footer-brand\">
      <img src=\"/assets/mark.png\" width=\"30\" height=\"30\" alt=\"\"/>
      <span>CinemaGraphy NEXT</span>
    </div>
    <div class=\"footer-links\">
      <a href=\"#clients\">کلاینت</a>
      <a href=\"#install\">نصب</a>
      <a href=\"/manifest.json\" dir=\"ltr\">manifest</a>
      <a href=\"/health\" dir=\"ltr\">health</a>
      <a href=\"https://github.com/TheNerdCow/CinemaGraphy-next\" target=\"_blank\" rel=\"noopener\">GitHub</a>
    </div>
    <div class=\"footer-meta\">v${esc(version)}</div>
  </div>
</footer>
<script>
(function(){
  document.querySelectorAll('[data-copy]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var v=btn.getAttribute('data-copy')||'';
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(v).then(function(){btn.textContent='کپی شد';});
      }
    });
  });
})();
</script>
</body>
</html>`
}

export default renderLanding
