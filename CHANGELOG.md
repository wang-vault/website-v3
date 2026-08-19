# Changelog

Semua perubahan penting pada WangStore dicatat di file ini.

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/).

## [1.0.0] - 2026-08-20

### Ditambahkan

- **Server Builder**: Tier Low (custom CPU/RAM/Storage), Medium & High (katalog paket database-driven), VPS Package Store.
- **Pricing engine** shared (UI + API): formula Low, normalisasi, safety limits, estimasi performa deterministik.
- **Order flow** lengkap: validasi Zod, sanitasi, CSRF, harga server-side, transaction, audit log, WhatsApp URL.
- **Authentication**: register, login, logout, email verification, forgot/reset password, change password, session aman, RBAC (Owner/Admin/Staff/Customer + permission matrix).
- **Customer Portal**: ringkasan, pesanan, layanan (lifecycle + renewal + reminder), konfigurasi tersimpan, tiket, kupon, notifikasi, profil.
- **Admin Panel**: 14 modul termasuk kelola paket Medium/High (Owner), formula harga, VPS, layanan, kupon, CMS generic, analitik, audit log, roles, pengaturan.
- **Service lifecycle**: status derived dari waktu server, renewal, manual extension (audited), reminder idempotent + Vercel Cron.
- **CMS**: generic resource handler untuk pages/faq/testimonials/blog/knowledgeBase/legal/announcements/incidents/maintenance.
- **Public pages**: homepage, about, features, why-wangstore, infrastructure, faq, testimonials, blog, knowledge base, status, contact, legal pages.
- **SEO**: sitemap, robots, canonical, OpenGraph, Twitter Cards, structured data, noindex rute privat.
- **Security**: security headers, CSRF double-submit, rate limiting, bcrypt 12, sanitasi, payload limits, audit log.
- **Database**: `database/schema.sql` (30+ tabel), driver PostgreSQL cloud + JSON fallback dev, seed idempotent.
- **Testing**: unit + acceptance (42 test), HTTP smoke (36 cek), E2E (18 cek).
- **Docs**: README, ARCHITECTURE, DEPLOYMENT, SECURITY, API.

### Catatan

- User pertama yang mendaftar otomatis menjadi **Owner**.
- Tanpa `DATABASE_URL`, production/preview gagal eksplisit (JSON fallback hanya untuk development).
- SMTP & WhatsApp number belum dikonfigurasi di environment verifikasi — status ditampilkan jujur.
