<div align="center">
  <img src="src/runtimes/node/assets/favandinstall.png" width="100" height="100" style="border-radius: 50%; border: 2px solid #e8a317;" alt="CinemaGraphy NEXT Logo">
  <h1>سینماگرافی NEXT (CinemaGraphy NEXT)</h1>
  <p><strong>افزونه پیشرفته استریمیو و نوویو برای دسترسی به فیلم، سریال و انیمه از منابع ایرانی</strong></p>

  <p>
    <a href="https://github.com/TheNerdCow/CinemaGraphy-next/releases"><img src="https://img.shields.io/badge/version-0.6.6-orange.svg" alt="Version"></a>
    <img src="https://img.shields.io/badge/Stremio-Compatible-purple.svg" alt="Stremio">
    <img src="https://img.shields.io/badge/Render-Ready-blue.svg" alt="Render.com">
    <img src="https://img.shields.io/badge/Vercel-Ready-blue.svg" alt="Vercel">
  </p>
</div>

---

## 🌟 درباره پروژه
**CinemaGraphy NEXT** یک افزونه (Addon) مدرن، سبک و چندمنبعی است که به طور ویژه برای دسترسی به آرشیوهای محتوایی ایران طراحی شده است. برای حفظ سادگی و کاربری روان، تنظیمات پیچیده کاتالوگ حذف شده‌اند؛ فقط کافیست منبع را تیک بزنید و استریمیو خودبه‌خود محتوا را یکپارچه می‌کند.

---

## 🚀 آموزش دیپلوی (اجرا) رایگان و پایدار

این پروژه بر بستر **Node.js (Express)** نوشته شده است. پلتفرم‌هایی مثل Cloudflare Workers به دلیل نداشتن هارد دیسک (File System) مناسب این پروژه نیستند و باعث کرش کردن سرور می‌شوند. بهترین راه‌حل‌های جایگزین و رایگان:

### 🌐 روش اول: استقرار رایگان در Render.com (پیشنهاد ویژه)
Render بهترین و سازگارترین میزبان رایگان برای برنامه‌های Node.js است:
1. در سایت [Render.com](https://render.com) ثبت‌نام کنید.
2. روی دکمه **New** کلیک کرده و **Web Service** را انتخاب کنید.
3. گیت‌هاب خود را متصل کرده و این ریپازیتوری را انتخاب کنید.
4. تمام تنظیمات را روی حالت پیش‌فرض بگذارید (Build Command: `npm install` و Start Command: `npm start`) و دکمه **Deploy** را بزنید.

### 🔺 روش دوم: دیپلوی با Vercel
ورسل (Vercel) نیز به راحتی این سرور را اجرا می‌کند:
1. در سایت **Vercel.com** لاگین کنید.
2. روی **Add New -> Project** کلیک کنید.
3. گیت‌هاب خود را متصل کرده و این ریپازیتوری را `Import` کنید و Deploy را بزنید.

### 💻 روش سوم: اجرا روی سرور شخصی (VPS / Docker)
```bash
git clone [https://github.com/TheNerdCow/CinemaGraphy-next.git](https://github.com/TheNerdCow/CinemaGraphy-next.git)
cd CinemaGraphy-next
npm install
npm start