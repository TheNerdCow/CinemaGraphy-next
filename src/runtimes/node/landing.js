/**
 * CinemaGraphy NEXT — Clean RTL Landing Page
 */
import { ASSET_BG, ASSET_MARK, ASSET_FAV, ASSET_DIGI_FAV } from './landing-assets.js'

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function stripProto(u) { const s = String(u || ''); if (s.startsWith('https://')) return s.slice(8); if (s.startsWith('http://')) return s.slice(7); return s; }

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

  const flashHtml = flash ? `<div class="flash ${flash.ok ? 'ok' : 'err'}" role="status"><span>${esc(flash.msg)}</span></div>` : ''
  const installResult = personalPath
    ? `<div class="panel custom-result" style="border-color: rgba(16, 185, 129, 0.4); margin-bottom: 16px;">
        <div class="result-head"><span class="result-badge">آماده نصب</span><span class="result-title">مانیفست شخصی شما ساخته شد</span></div>
        <div class="result-url" dir="ltr">${esc(personalPath)}</div>
        <div class="btn-row" style="justify-content: flex-start; margin-top: 8px;">
          <a class="btn btn-gold" href="stremio://${esc(stripProto(personalPath))}">نصب در استریمیو</a>
          <a class="btn btn-ghost" href="stremio://${esc(stripProto(personalPath))}">نصب در نوویو</a>
          <button type="button" class="btn btn-ghost" data-copy="${esc(personalPath)}" data-label="کپی لینک">کپی لینک</button>
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
:root { --bg: #070912; --card: #0b0f1c; --line: rgba(255, 255, 255, 0.08); --gold: #e8a317; --text: #f8fafc; --muted: #94a3b8; --ok: #10b981; --err: #ef4444; --radius: 14px; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { font-family: 'Vazirmatn', sans-serif; background-color: var(--bg); color: var(--text); min-height: 100vh; overflow-x: hidden; position: relative; line-height: 1.55; }
.bg-castle { position: fixed; inset: 0; background: url('${ASSET_BG}') center/cover no-repeat; filter: brightness(0.4) contrast(1.1); z-index: -2; }
.bg-overlay { position: fixed; inset: 0; background: radial-gradient(circle at 50% 12%, rgba(7, 9, 18, 0.45) 0%, rgba(7, 9, 18, 0.88) 70%, #070912 100%); z-index: -1; }
.page-wrap { max-width: 920px; margin: 0 auto; padding: 20px 16px 36px; display: flex; flex-direction: column; gap: 14px; }
.panel { background: rgba(12, 16, 28, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.65); }
.hero { text-align: center; border-color: rgba(232, 163, 23, 0.22); }
.logo-badge-wrap { width: 86px; height: 86px; margin: 0 auto 10px; border-radius: 50%; background: var(--card); border: 1.5px solid rgba(232, 163, 23, 0.34); box-shadow: 0 0 26px rgba(232, 163, 23, 0.22); padding: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.logo-badge-wrap img { width: 100%; height: 100%; object-fit: contain; }
.v-badge { display: inline-block; font-size: 0.72rem; font-weight: 700; color: var(--gold); background: rgba(232, 163, 23, 0.12); border: 1px solid rgba(232, 163, 23, 0.28); padding: 2px 10px; border-radius: 999px; margin-bottom: 8px; direction: ltr; }
.hero h1 { font-size: clamp(1.55rem, 3.6vw, 2.05rem); font-weight: 900; margin-bottom: 2px; }
.hero h1 .next { background: linear-gradient(135deg, #fde047 0%, var(--gold) 55%, #ea580c 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hero-sub { font-size: 0.9rem; font-weight: 700; color: var(--gold); margin-bottom: 6px; }
.hero-desc { font-size: 0.84rem; color: var(--muted); max-width: 460px; margin: 0 auto 16px; }
.btn-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 9px 15px; border-radius: 10px; font-family: inherit; font-size: 0.83rem; font-weight: 700; text-decoration: none; cursor: pointer; border: 1px solid transparent; transition: all 0.14s ease; }
.btn:hover { transform: translateY(-1px); }
.btn-gold { background: linear-gradient(135deg, var(--gold) 0%, #d97706 100%); color: #070912; box-shadow: 0 4px 16px rgba(232, 163, 23, 0.28); }
.btn-ghost { background: rgba(255, 255, 255, 0.04); color: var(--text); border-color: var(--line); }
.btn-ghost:hover { border-color: rgba(232, 163, 23, 0.35); color: var(--gold); }
.btn.copied { background: rgba(16, 185, 129, 0.18) !important; color: #34d399 !important; border-color: rgba(16, 185, 129, 0.45) !important; }
.sec-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.sec-title { display: flex; align-items: center; gap: 7px; font-size: 0.94rem; font-weight: 800; }
.sec-title svg { width: 18px; height: 18px; color: var(--gold); }
.sources-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.src-card { background: rgba(255, 255, 255, 0.025); border: 1px solid var(--line); border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 7px; }
.src-head { display: flex; align-items: center; gap: 7px; direction: ltr; }
.src-fav { width: 18px; height: 18px; border-radius: 4px; object-fit: contain; }
.src-name { font-size: 0.8rem; font-weight: 700; }
.src-foot { display: flex; align-items: center; justify-content: space-between; font-size: 0.68rem; }
.st-badge { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; color: var(--muted); }
.st-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); }
.st-badge.online { color: #34d399; }
.st-badge.online .st-dot { background: var(--ok); box-shadow: 0 0 7px var(--ok); }
.st-badge.offline { color: #f87171; }
.st-badge.offline .st-dot { background: var(--err); }
.prov-select-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 12px; }
.prov-chk { position: relative; cursor: pointer; user-select: none; }
.prov-chk input { position: absolute; opacity: 0; pointer-events: none; }
.prov-pill { display: flex; align-items: center; gap: 7px; padding: 9px 10px; border-radius: 10px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--line); transition: all 0.15s; }
.prov-pill span { font-size: 0.78rem; font-weight: 700; direction: ltr; }
.tick-box { width: 15px; height: 15px; border-radius: 4px; border: 1.5px solid var(--muted); margin-right: auto; display: grid; place-items: center; transition: all 0.15s; }
.tick-box svg { width: 11px; height: 11px; opacity: 0; stroke: #070912; }
.prov-chk input:checked + .prov-pill { background: rgba(232, 163, 23, 0.12); border-color: var(--gold); }
.prov-chk input:checked + .prov-pill .tick-box { background: var(--gold); border-color: var(--gold); }
.prov-chk input:checked + .prov-pill .tick-box svg { opacity: 1; }
.sub-panels { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.sub-drawer { display: none; background: rgba(7, 9, 18, 0.6); border: 1px solid rgba(232, 163, 23, 0.26); border-radius: 11px; padding: 12px; }
.sub-drawer.open { display: block; }
.sub-drawer-head { display: flex; align-items: center; gap: 7px; font-size: 0.8rem; font-weight: 700; color: var(--gold); margin-bottom: 9px; }
.inputs-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.inp-group { display: flex; flex-direction: column; gap: 4px; }
.inp-group label { font-size: 0.74rem; font-weight: 600; color: var(--muted); }
.ltr-field { direction: ltr; text-align: left; width: 100%; padding: 8px 11px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.04); color: var(--text); font-family: monospace; font-size: 0.79rem; outline: none; }
.ltr-field:focus { border-color: var(--gold); }
.flash { padding: 10px 12px; border-radius: 9px; margin-bottom: 12px; font-size: 0.82rem; font-weight: 600; }
.flash.ok { background: rgba(16, 185, 129, 0.14); border: 1px solid rgba(16, 185, 129, 0.35); color: #6ee7b7; }
.flash.err { background: rgba(239, 68, 68, 0.14); border: 1px solid rgba(239, 68, 68, 0.35); color: #fca5a5; }
.custom-result { padding: 13px; border-radius: 11px; background: rgba(232, 163, 23, 0.08); border: 1px solid rgba(232, 163, 23, 0.35); }
.result-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.result-badge { background: var(--gold); color: #070912; font-size: 0.68rem; font-weight: 800; padding: 1px 7px; border-radius: 5px; }
.result-title { font-size: 0.84rem; font-weight: 700; }
.result-url { padding: 7px 10px; border-radius: 7px; background: rgba(0, 0, 0, 0.35); border: 1px solid var(--line); font-family: monospace; font-size: 0.74rem; color: #fde68a; word-break: break-all; margin-bottom: 10px; }
@media (max-width: 760px) { .inputs-2col { grid-template-columns: 1fr; } .sources-row, .prov-select-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
</head>
<body>
<div class="bg-castle"></div>
<div class="bg-overlay"></div>

<main class="page-wrap">
  <section class="panel hero">
    <div class="logo-badge-wrap"><img src="${ASSET_MARK}" alt="CinemaGraphy NEXT"/></div>
    <span class="v-badge">v${esc(version)}</span>
    <h1>سینماگرافی <span class="next">NEXT</span></h1>
    <div class="hero-sub">فیلم، سریال، انیمه</div>
    <p class="hero-desc">استریم مستقیم از منابع معتبر ایرانی در استریمیو و نوویو با قابلیت شخصی‌سازی منابع.</p>
  </section>

  <section class="panel">
    <div class="sec-bar"><div class="sec-title">وضعیت منابع</div></div>
    <div class="sources-row" id="sourcesGrid">
      <div class="src-card" data-source="f2media" data-domain="myf2ms.top">
        <div class="src-head"><img class="src-fav" src="${FAVICONS.f2media}" alt="F2Media"/><span class="src-name">F2Media</span></div>
        <div class="src-foot"><span class="st-badge"><i class="st-dot"></i><b class="st-txt">بررسی...</b></span></div>
      </div>
      <div class="src-card" data-source="cinamatic" data-domain="cinamatic.top">
        <div class="src-head"><img class="src-fav" src="${FAVICONS.cinamatic}" alt="Cinamatic"/><span class="src-name">Cinamatic</span></div>
        <div class="src-foot"><span class="st-badge"><i class="st-dot"></i><b class="st-txt">بررسی...</b></span></div>
      </div>
      <div class="src-card" data-source="aslmoviez" data-domain="aslmoviez.com">
        <div class="src-head"><img class="src-fav" src="${FAVICONS.aslmoviez}" alt="AslMoviez"/><span class="src-name">AslMoviez</span></div>
        <div class="src-foot"><span class="st-badge"><i class="st-dot"></i><b class="st-txt">بررسی...</b></span></div>
      </div>
      <div class="src-card" data-source="avamovie" data-domain="avadel.top">
        <div class="src-head"><img class="src-fav" src="${FAVICONS.avamovie}" alt="AvaMovie"/><span class="src-name">AvaMovie</span></div>
        <div class="src-foot"><span class="st-badge"><i class="st-dot"></i><b class="st-txt">بررسی...</b></span></div>
      </div>
      <div class="src-card" data-source="digimovie" data-domain="digimoviez53.top">
        <div class="src-head"><img class="src-fav" src="${FAVICONS.digimovie}" alt="DigiMovie"/><span class="src-name">DigiMovie</span></div>
        <div class="src-foot"><span class="st-badge"><i class="st-dot"></i><b class="st-txt">بررسی...</b></span></div>
      </div>
    </div>
  </section>

  <section class="panel" id="install">
    <div class="sec-bar"><div class="sec-title">نصب و پیکربندی مانیفست</div></div>
    ${flashHtml}${installResult}
    
    <form method="post" action="/configure#install">
      <div class="prov-select-grid">
        <label class="prov-chk"><input type="checkbox" name="providers" value="f2media"${selAttr('f2media')}/><div class="prov-pill"><img class="src-fav" src="${FAVICONS.f2media}"/><span>F2Media</span><div class="tick-box"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div></div></label>
        <label class="prov-chk"><input type="checkbox" name="providers" value="cinamatic"${selAttr('cinamatic')}/><div class="prov-pill"><img class="src-fav" src="${FAVICONS.cinamatic}"/><span>Cinamatic</span><div class="tick-box"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div></div></label>
        <label class="prov-chk"><input type="checkbox" name="providers" value="aslmoviez"${selAttr('aslmoviez')}/><div class="prov-pill"><img class="src-fav" src="${FAVICONS.aslmoviez}"/><span>AslMoviez</span><div class="tick-box"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div></div></label>
        <label class="prov-chk"><input type="checkbox" id="chk-ava" name="providers" value="avamovie"${selAttr('avamovie')}/><div class="prov-pill"><img class="src-fav" src="${FAVICONS.avamovie}"/><span>AvaMovie</span><div class="tick-box"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div></div></label>
        <label class="prov-chk"><input type="checkbox" id="chk-digi" name="providers" value="digimovie"${selAttr('digimovie')}/><div class="prov-pill"><img class="src-fav" src="${FAVICONS.digimovie}"/><span>DigiMovie</span><div class="tick-box"><svg viewBox="0 0 24 24" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div></div></label>
      </div>

      <div class="sub-panels">
        <div class="sub-drawer ${isSel('avamovie') ? 'open' : ''}" id="drawer-ava">
          <div class="sub-drawer-head"><img class="src-fav" src="${FAVICONS.avamovie}"/><span>تنظیمات اشتراک AvaMovie</span></div>
          <div class="inputs-2col">
            <div class="inp-group"><label>کوکی حساب (Cookie)</label><input type="password" name="avaCookie" class="ltr-field" value="${esc(cookieValue)}" placeholder="your cookie here"/></div>
            <div class="inp-group"><label>آدرس دامنه</label><input type="text" name="avaBaseUrl" class="ltr-field" value="${esc(avaBaseUrl)}"/></div>
          </div>
        </div>
        <div class="sub-drawer ${isSel('digimovie') ? 'open' : ''}" id="drawer-digi">
          <div class="sub-drawer-head"><img class="src-fav" src="${FAVICONS.digimovie}"/><span>تنظیمات اشتراک DigiMovie</span></div>
          <div class="inputs-2col">
            <div class="inp-group"><label>کوکی حساب (Cookie)</label><input type="password" name="digiCookie" class="ltr-field" value="${esc(digiCookieValue)}" placeholder="your cookie here"/></div>
            <div class="inp-group"><label>آدرس دامنه</label><input type="text" name="digiBaseUrl" class="ltr-field" value="${esc(digiBaseUrl)}"/></div>
          </div>
        </div>
      </div>

      <button type="submit" class="btn btn-gold" style="width:100%; padding:12px;">ساخت مانیفست شخصی</button>
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
  toggleDrawer('chk-ava', 'drawer-ava');
  toggleDrawer('chk-digi', 'drawer-digi');

  function setStatus(card, isOnline) {
    var pill = card.querySelector('.st-badge');
    var txt = card.querySelector('.st-txt');
    if (!pill || !txt) return;
    pill.classList.remove('online', 'offline');
    pill.classList.add(isOnline ? 'online' : 'offline');
    txt.textContent = isOnline ? 'آنلاین' : 'آفلاین';
  }

  // بررسی وضعیت مستقیماً توسط مرورگر برای دور زدن کامل محدودیت‌های سرور
  document.querySelectorAll('.src-card[data-domain]').forEach(card => {
    var domain = card.getAttribute('data-domain');
    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); }, 6000);
    fetch('https://' + domain, { mode: 'no-cors', signal: controller.signal })
      .then(function(){ clearTimeout(timer); setStatus(card, true); })
      .catch(function(){ clearTimeout(timer); setStatus(card, false); });
  });
})();
</script>
</body>
</html>`
}

export default renderLanding