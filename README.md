<div align="center">
  <img src="src/runtimes/node/assets/favandinstall.png" width="100" height="100" style="border-radius: 50%; border: 2px solid #e8a317;" alt="CinemaGraphy NEXT Logo">
  <h1>سینماگرافی NEXT (CinemaGraphy NEXT)</h1>
  <p><strong>افزونه پیشرفته استریمیو و نوویو برای دسترسی به فیلم، سریال و انیمه از منابع ایرانی</strong></p>

  <p>
    <a href="https://github.com/TheNerdCow/CinemaGraphy-next/releases"><img src="https://img.shields.io/badge/version-0.6.6-orange.svg" alt="Version"></a>
    <img src="https://img.shields.io/badge/Stremio-Compatible-purple.svg" alt="Stremio">
    <img src="https://img.shields.io/badge/Vercel-Ready-blue.svg" alt="Vercel">
  </p>
</div>

---

## 🌟 درباره پروژه
**CinemaGraphy NEXT** یک افزونه (Addon) مدرن، سبک و چندمنبعی است که به طور ویژه برای دسترسی به آرشیوهای محتوایی ایران در پلتفرم‌های **Stremio** و **Nuvio** طراحی شده است.

---

## ✨ ویژگی‌های کلیدی
* **منابع معتبر ایرانی:** پشتیبانی از دامنه‌های بدون فیلتر (`F2Media`, `Cinamatic`, `AslMoviez`, `AvaMovie`, `DigiMovie`).
* **کشینگ هوشمند (ضد اسپم):** ذخیره نتایج در حافظه موقت سرور برای جلوگیری از مسدود شدن آی‌پی توسط سایت‌های فیلم.
* **صفحه پیکربندی Liquid Glass:** طراحی شده به صورت تک‌صفحه‌ای با افکت شیشه‌ای مدرن. کاربر منابع دلخواه را تیک می‌زند و تمام کاتالوگ‌های آن منبع در استریمیو ظاهر می‌شود.

---

## 🚀 آموزش دیپلوی (اجرا) روی سرور

هسته قدرتمند این پروژه (Express.js) قابلیت اجرا روی اکثر پلتفرم‌های میزبانی از جمله سرورهای ابری، VPS و Vercel را دارد.

### ۱. اجرای استاندارد روی VPS / هاست (Node.js) - پیشنهاد اصلی
برای پایداری ۱۰۰٪، نصب روی سرور لینوکس بهترین گزینه است:
```bash
git clone [https://github.com/TheNerdCow/CinemaGraphy-next.git](https://github.com/TheNerdCow/CinemaGraphy-next.git)
cd CinemaGraphy-next
npm install
npm start