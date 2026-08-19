# WangStore — Build Your Own Server.

**WangStore** adalah platform e-commerce/SaaS untuk **menjual layanan hosting**, menerima pesanan, mengelola akun pelanggan, dan menyediakan dashboard administrasi.

> ⚠️ WangStore **bukan** infrastructure hosting dan **bukan** Minecraft control panel. Aplikasi ini tidak menjalankan server Minecraft, VPS, Docker, Wings, Pterodactyl, atau infrastruktur hosting pelanggan. WangStore menangani: katalog layanan, Server Builder, kalkulasi harga, akun, pemesanan, order management, customer portal, kupon, tiket, WhatsApp, admin panel, CMS, blog, knowledge base, FAQ, status, legal pages, analitik, dan audit log.

---

## Fitur Utama

| Area | Ringkasan |
|---|---|
| **Server Builder** | 3 Tier: **Low** (konfigurasi custom CPU/RAM/Penyimpanan), **Medium & High** (katalog paket dari database, dikelola Owner). Harga & estimasi real-time. |
| **Pricing engine** | Satu modul shared (`src/lib/pricing`) dipakai UI **dan** API. Harga selalu dihitung ulang server-side. |
| **Order flow** | `POST /api/orders` → validasi Zod → sanitasi → normalisasi → verifikasi tier/paket/kupon → harga server-side → transaction → audit log → WhatsApp URL. |
| **Service lifecycle** | `pending → scheduled → active → expired` dihitung dari **waktu server/database**; perpanjangan (renewal), reminder idempotent, manual extension (admin, ter-audit). |
| **VPS Package Store** | Katalog paket VPS database-driven: spesifikasi, lokasi, bandwidth, harga, renewable, stock/status. |
| **Auth** | Register, login, logout, email verification, forgot/reset password, change password, session aman, RBAC (Owner > Admin > Staff + permission matrix), 2FA-ready. |
| **Customer Portal** | Dashboard: ringkasan, pesanan, **Layanan Saya**, konfigurasi tersimpan, tiket, kupon, notifikasi, profil. |
| **Admin Panel** | 14 modul: ringkasan, pesanan, pelanggan, layanan, VPS packages, paket Medium/High, formula harga, kupon, tiket, CMS, analitik, audit log, users & roles, pengaturan. |
| **CMS** | Generic resource handler untuk pages, FAQ, testimoni, blog, knowledge base, legal, pengumuman, insiden, maintenance. |
| **Public pages** | Homepage, about, infrastructure, server-builder, features, why-wangstore, faq, testimonials, blog, knowledge-base, status, contact, terms, privacy, refund, sla, acceptable-use, cookie-policy. |
| **SEO** | sitemap.xml, robots.txt, canonical, OpenGraph, Twitter Cards, structured data (Organization, FAQPage, BlogPosting, TechArticle, ContactPage), noindex rute privat. |
| **Security** | Sesi HttpOnly/SameSite/Secure, CSRF double-submit + Origin validation, rate limiting, security headers (CSP, HSTS, X-Frame-Options…), bcrypt cost 12, audit log, payload limits, sanitasi rekursif. |

---

## Tech Stack

- **Next.js 14 (App Router)** + React 18 + **TypeScript strict**
- **Tailwind CSS** (sistem warna hitam/putih/abu, light & dark mode)
- **Zod** (validasi), **jose** (JWT token verifikasi/reset), **bcryptjs** (password)
- **PostgreSQL cloud/serverless** (Supabase / Neon / Vercel Postgres / Railway — via `DATABASE_URL`)
- **JSON datastore lokal** — fallback **development saja** (atomic write, transaction, auto-seed)
- **Nodemailer (SMTP)** — email verification & reset password
- **lucide-react**, **react-markdown** + **remark-gfm**

---

## Arsitektur Singkat

```
Browser (Next.js App Router)
   │
   ├── Server Components (halaman, SEO, konten)
   ├── Client Components (Server Builder, formulir, dashboard)
   └── API Routes (/api/*)
          │
          ├── Shared modules (source of truth):
          │     src/lib/pricing    — harga & estimasi (UI + API)
          │     src/lib/services   — lifecycle, renewal, reminder
          │     src/lib/validation — Zod schema (shared)
          │     src/lib/security   — CSRF, sanitasi, origin
          │     src/lib/api        — wrapper route (auth/RBAC/ratelimit)
          │
          └── Data layer (src/lib/db):
                PostgreSQL cloud  ── production/preview
                JSON datastore    ── local development only
```

**Sumber kebenaran (source of truth):**
- PostgreSQL cloud = data produksi.
- Waktu **server/database** = lifecycle (activation/expiration/reminder).
- Modul shared server-side = pricing, validasi, authorization, transisi bisnis.
- Browser hanya untuk input, presentasi, dan state non-sensitive.

---

## Local Development

```bash
git clone <repository-url>
cd wangstore
npm install
cp .env.example .env.local   # isi variabel yang diperlukan
npm run db:migrate           # hanya jika DATABASE_URL diisi (PostgreSQL cloud)
npm run db:seed              # hanya jika DATABASE_URL diisi
npm run dev                  # http://localhost:3000
```

**Tanpa database cloud?** Jika `DATABASE_URL` kosong dan `NODE_ENV=development`, aplikasi otomatis memakai **JSON datastore lokal** (`data/wangstore.json`) yang di-seed otomatis. Ini **hanya untuk development** — production/preview tanpa `DATABASE_URL` akan **gagal secara eksplisit**.

> Catatan: pada development, tautan verifikasi email & reset password ditampilkan langsung di respons API (karena SMTP belum dikonfigurasi). Di production, tautan hanya dikirim via SMTP.

---

## Scripts

| Script | Fungsi |
|---|---|
| `npm run dev` | Dev server (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Jalankan hasil build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next) |
| `npm test` | Vitest — unit + acceptance tests |
| `npm run db:migrate` | Terapkan `database/schema.sql` ke PostgreSQL |
| `npm run db:seed` | Seed data awal (idempotent) |
| `npm run smoke` | HTTP smoke test (server harus berjalan) |
| `node tests/e2e.mjs` | E2E flow lengkap via HTTP |

---

## Akun Pertama = OWNER

User pertama yang mendaftar otomatis menjadi **Owner** (akses penuh, termasuk membuat paket Medium/High dan mengelola role). Setelah itu, semua pendaftar menjadi **customer** biasa. Ini memudahkan deployment: daftar → login → Admin Panel.

---

## Dokumentasi Lengkap

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arsitektur, domain model, permission matrix
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — panduan deploy GitHub → Vercel → cloud database + SMTP
- [docs/SECURITY.md](docs/SECURITY.md) — model keamanan & checklist
- [docs/API.md](docs/API.md) — referensi endpoint

---

## Testing

```bash
npm run typecheck   # 0 error
npm run lint        # 0 warning/error
npm test            # pricing, order API, lifecycle, security (42 test)
npm run build       # production build sukses
npm run smoke       # HTTP smoke test (36 cek)
node tests/e2e.mjs  # E2E flow (18 cek)
```

Acceptance tests mencakup (sesuai spesifikasi):
- Low minimum 2/4/20 → **Rp45.000 raw → Rp50.000 final**
- Low overflow 20/64/900 → **16/32/160**
- Medium tanpa paket → **HTTP 409/422** (tidak pernah Rp0)
- Fake package → **HTTP 422**
- Harga dari client **diabaikan**
- Paket Medium/High dibuat via Owner flow → muncul di Builder → dipakai Order API
- Lifecycle: scheduled/active/expired, renewal active/expired, reminder idempotent
- CSRF cross-origin → **403**, RBAC enforced, coupon expired/limit → ditolak

---

## Status Verifikasi (jujur)

| Item | Status |
|---|---|
| Typecheck / lint / build | ✅ 0 error, 0 warning, build sukses |
| Unit + acceptance tests (vitest) | ✅ 42/42 |
| HTTP smoke test | ✅ 36/36 |
| E2E flow (register→verify→login→order→dashboard) | ✅ 18/18 |
| Deployment Vercel + PostgreSQL cloud + SMTP | ⬜ **Belum diverifikasi** (butuh environment eksternal) — panduan lengkap di `docs/DEPLOYMENT.md` |
| SMTP terkirim | ⬜ Belum (SMTP belum dikonfigurasi di environment ini) |

## Lisensi

MIT — lihat [LICENSE](LICENSE).
