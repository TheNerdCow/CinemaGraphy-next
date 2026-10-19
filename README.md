<div align="center">
  <img src="https://raw.githubusercontent.com/TheNerdCow/CinemaGraphy-next/main/src/runtimes/node/assets/favandinstall.png" width="100" height="100" style="border-radius: 50%; border: 2px solid #e8a317;" alt="CinemaGraphy NEXT Logo">
  <h1>سینماگرافی NEXT (CinemaGraphy NEXT)</h1>
  <p><strong>افزونه پیشرفته استریمیو و نوویو برای دسترسی به فیلم، سریال و انیمه از منابع ایرانی</strong></p>

  <p>
    <a href="https://github.com/TheNerdCow/CinemaGraphy-next/releases"><img src="https://img.shields.io/badge/version-0.6.6-orange.svg" alt="Version"></a>
    <img src="https://img.shields.io/badge/Stremio-Compatible-purple.svg" alt="Stremio">
    <img src="https://img.shields.io/badge/CF_Workers-Ready-blue.svg" alt="Cloudflare Workers">
    <img src="https://img.shields.io/badge/Vercel-Ready-blue.svg" alt="Vercel">
  </p>
</div>

---

## 🌟 درباره پروژه
**CinemaGraphy NEXT** یک افزونه (Addon) مدرن، سبک و چندمنبعی است که به طور ویژه برای دسترسی به آرشیوهای محتوایی ایران طراحی شده است. برای حفظ سادگی و کاربری روان، نیازی به تنظیمات پیچیده کاتالوگ نیست؛ فقط منبع را تیک بزنید و استریمیو خودبه‌خود محتوا را یکپارچه می‌کند.

---

## 🚀 آموزش دیپلوی روی سرور (Self-Hosting)

معماری این پروژه کاملاً مدرن شده و با **Cloudflare Workers** (به‌صورت Native) و **Vercel** سازگار است.

### 🌐 روش اول: استقرار مستقیم روی Cloudflare Workers (بدون نیاز به سرور)
با این روش نیازی به دانلود کدها ندارید و همه‌چیز از طریق داشبورد کلادفلر انجام می‌شود:

1. وارد حساب کاربری خود در **Cloudflare Dashboard** شوید.
2. از منوی سمت چپ به بخش **Workers & Pages** بروید.
3. روی دکمه آبی‌رنگ **Create application** کلیک کنید.
4. تب **Workers** را انتخاب کرده و دکمه **Connect to GitHub** را بزنید.
5. وارد حساب گیت‌هاب خود شوید و مخزن `CinemaGraphy-next` را انتخاب کنید.
6. کلادفلر به صورت خودکار فایل `wrangler.toml` را در کدهای شما پیدا کرده و پروژه را دیپلوی می‌کند. تمام!

### 💻 روش دوم: دیپلوی روی Vercel
ورسل (Vercel) هم به صورت بومی از این ساختار پشتیبانی می‌کند:
1. در سایت **Vercel.com** لاگین کنید.
2. روی **Add New -> Project** کلیک کنید.
3. گیت‌هاب خود را متصل کرده و این ریپازیتوری را `Import` کنید.
4. دکمه Deploy را بزنید.

### 🐳 روش سوم: دیپلوی با Docker / Node.js
اگر سرور اختصاصی دارید:
```bash
git clone [https://github.com/TheNerdCow/CinemaGraphy-next.git](https://github.com/TheNerdCow/CinemaGraphy-next.git)
cd CinemaGraphy-next
npm install
npm start