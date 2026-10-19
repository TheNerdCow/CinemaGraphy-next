<div align="center">
  <img src="https://raw.githubusercontent.com/TheNerdCow/CinemaGraphy-next/main/src/runtimes/node/assets/favandinstall.png" width="100" height="100" style="border-radius: 50%; border: 2px solid #e8a317;" alt="CinemaGraphy NEXT Logo">
  <h1>سینماگرافی NEXT (CinemaGraphy NEXT)</h1>
  <p><strong>افزونه پیشرفته استریمیو و نوویو برای دسترسی به فیلم، سریال و انیمه از منابع ایرانی</strong></p>

  <p>
    <a href="https://github.com/TheNerdCow/CinemaGraphy-next/releases"><img src="https://img.shields.io/badge/version-0.6.6-orange.svg" alt="Version"></a>
    <img src="https://img.shields.io/badge/Stremio-Compatible-purple.svg" alt="Stremio">
    <img src="https://img.shields.io/badge/CF_Workers-Native-blue.svg" alt="Cloudflare Workers">
  </p>
</div>

---

## 🌟 درباره پروژه
**CinemaGraphy NEXT** یک افزونه (Addon) مدرن، سبک و چندمنبعی است که به طور ویژه برای دسترسی به آرشیوهای محتوایی ایران در پلتفرم‌های **Stremio** و **Nuvio** طراحی شده است.

---

## 🚀 آموزش دیپلوی (اجرا) روی سرور

معماری این پروژه کاملاً مدرن شده و با **Cloudflare Workers** (به‌صورت Native) و **Node.js** سازگار است.

### 🌐 روش اول: اجرای کاملاً رایگان روی Cloudflare Workers (از طریق داشبورد کلادفلر)
با این روش نیازی به دانلود کدها ندارید و همه‌چیز از طریق مرورگر انجام می‌شود:

1. وارد حساب کاربری خود در **Cloudflare Dashboard** شوید.
2. از منوی سمت چپ به بخش **Workers & Pages** بروید.
3. روی دکمه آبی‌رنگ **Create application** کلیک کنید.
4. تب **Workers** را انتخاب کرده و دکمه **Connect to GitHub** را بزنید.
5. وارد حساب گیت‌هاب خود شوید و مخزن `CinemaGraphy-next` را انتخاب کنید.
6. کلادفلر به صورت خودکار فایل `wrangler.toml` را در کدهای شما پیدا کرده و پروژه را در کمتر از ۱ دقیقه نصب و اجرا (Deploy) می‌کند. تمام! لینک آماده‌ی شما در دسترستان قرار می‌گیرد.

---

### 💻 روش دوم: اجرا روی سرور شخصی (Node.js)
اگر می‌خواهید روی هاست شخصی یا VPS پروژه را بالا بیاورید:
```bash
git clone [https://github.com/TheNerdCow/CinemaGraphy-next.git](https://github.com/TheNerdCow/CinemaGraphy-next.git)
cd CinemaGraphy-next
npm install
npm start