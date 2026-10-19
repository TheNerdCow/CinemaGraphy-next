<div align="center">
  <img src="src/runtimes/node/assets/favandinstall.png" width="100" height="100" style="border-radius: 50%; border: 2px solid #e8a317;" alt="CinemaGraphy NEXT Logo">
  <h1>سینماگرافی NEXT (CinemaGraphy NEXT)</h1>
  <p><strong>افزونه پیشرفته استریمیو و نوویو برای دسترسی به فیلم، سریال و انیمه از منابع ایرانی</strong></p>

  <p>
    <a href="https://github.com/TheNerdCow/CinemaGraphy-next/releases"><img src="https://img.shields.io/badge/version-0.6.6-orange.svg" alt="Version"></a>
    <img src="https://img.shields.io/badge/Stremio-Compatible-purple.svg" alt="Stremio">
    <img src="https://img.shields.io/badge/CF_Workers-Beta-blue.svg" alt="Cloudflare Workers">
    <img src="https://img.shields.io/badge/Docker-Ready-blue.svg" alt="Docker">
  </p>
</div>

---

## 🌟 درباره پروژه
**CinemaGraphy NEXT** یک افزونه (Addon) مدرن، سبک و چندمنبعی برای پلتفرم‌های پخش محتوا است که به طور ویژه برای دسترسی به آرشیوها و منابع محتوایی ایران طراحی شده است.

---

## ✨ ویژگی‌های کلیدی
* **پشتیبانی از منابع معتبر ایرانی:** با دامنه‌های به‌روز و بدون فیلتر (`F2Media`, `Cinamatic`, `AslMoviez`, `AvaMovie`, `DigiMovie`).
* **صفحه پیکربندی (Liquid Glass):** طراحی شده به صورت تک‌صفحه‌ای با افکت شیشه‌ای مدرن. کاربر منابع دلخواه را تیک می‌زند و تمام کاتالوگ‌های آن منبع در استریمیو ظاهر می‌شود.
* **بررسی زنده وضعیت منابع (بای‌پس Cloudflare):** بررسی هوشمند برای اطمینان از آنلاین بودن منابع حتی با وجود فایروال.

---

## 🚀 نصب و دیپلوی روی سرور (Self-Hosting)

معماری این پروژه به گونه‌ای تنظیم شده که علاوه بر **Node.js** سنتی، قابلیت دیپلوی روی محیط‌های مدرن مثل **Docker**, **Vercel** و **Cloudflare Workers** (به صورت بتا/تست‌نشده) را نیز دارد.

### ۱. اجرای استاندارد (Node.js)
```bash
git clone [https://github.com/TheNerdCow/CinemaGraphy-next.git](https://github.com/TheNerdCow/CinemaGraphy-next.git)
cd CinemaGraphy-next
npm install
npm start