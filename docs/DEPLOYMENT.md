# Deployment WangStore — GitHub → Vercel → Cloud Database + SMTP

Panduan lengkap men-deploy WangStore tanpa VPS. Target: **GitHub + Vercel + PostgreSQL cloud + SMTP provider**.

---

## 1. Arsitektur Deployment

```
GitHub (repository)
   │
   ▼
Vercel (Next.js serverless)
   │
   ├── PostgreSQL cloud (Supabase/Neon/Vercel Postgres/Railway)
   │     └── seluruh data aplikasi (orders, users, CMS, audit…)
   │
   └── SMTP provider (Resend/SendGrid/Brevo/Mailgun…)
         └── email verification & reset password
```

**Larangan deployment:** VPS, Docker, Nginx, PM2, systemd, cron lokal, filesystem persistent. Scheduled task memakai **Vercel Cron** (lihat §7).

---

## 2. Database Setup (PostgreSQL Cloud)

Contoh menggunakan **Supabase** (paling mudah untuk Vercel; provider lain seperti **Neon** atau **Vercel Postgres** juga didukung — cukup ganti `DATABASE_URL`).

### Supabase

1. Buat project di [supabase.com](https://supabase.com) → New project → pilih region → tunggu provisioning.
2. Buka **Project Settings → Database → Connection string**.
3. Salin **URI connection string** (format `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres` — gunakan port 6543 transaction pooler untuk serverless).
4. Set variabel `DATABASE_URL` (lihat §4). Tambahkan `?sslmode=require` bila belum ada.

### Menerapkan schema & seed

```bash
cp .env.example .env.local        # isi DATABASE_URL
npm run db:migrate                # menjalankan database/schema.sql (semua tabel, index, constraint)
npm run db:seed                   # seed idempotent: roles, permissions, tier, pricing, konten
```

> Semua tabel dibuat **hanya** melalui `database/schema.sql` (repository) — tidak ada tabel manual tanpa dokumentasi.

### Neon / Vercel Postgres / Railway

Sama: salin connection string dari dashboard provider → `DATABASE_URL`. (Neon: gunakan pooled connection `-pooler` untuk serverless.)

---

## 3. Email / SMTP Setup

SMTP digunakan untuk: **Email Verification** (register) dan **Reset Password** (forgot password).

| Variabel | Contoh |
|---|---|
| `SMTP_HOST` | `smtp.resend.com` / `smtp.sendgrid.net` / `smtp-relay.brevo.com` |
| `SMTP_PORT` | `587` (STARTTLS) atau `465` (SSL) |
| `SMTP_SECURE` | `false` untuk 587, `true` untuk 465 |
| `SMTP_USER` | API key / username provider |
| `SMTP_PASSWORD` | API key / password |
| `SMTP_FROM` | `no-reply@wangstore.example` (domain terverifikasi) |
| `SMTP_FROM_NAME` | `WangStore` |

**Test email (minimal):**
1. `npm run dev` → Daftar akun → email verifikasi harus tiba.
2. Klik tautan verifikasi → berhasil.
3. Login → **Lupa Kata Sandi** → email reset tiba → set password baru → login.

> Jangan mengklaim email terkirim jika SMTP belum dikonfigurasi. Pada development tanpa SMTP, tautan verifikasi/reset ditampilkan di respons API (hanya non-production). Di production tanpa SMTP, email tidak terkirim dan aplikasi menampilkan status jujur.

---

## 4. Environment Variables

Salin dari `.env.example`. Variabel yang benar-benar digunakan:

```
# APP
APP_URL=https://wangstore.example
NEXT_PUBLIC_APP_URL=https://wangstore.example
NEXT_PUBLIC_SITE_NAME=WangStore

# DATABASE
DATABASE_URL=postgresql://...

# AUTH (generate: openssl rand -base64 48)
AUTH_SECRET=...

# EMAIL
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=no-reply@wangstore.example
SMTP_FROM_NAME=WangStore

# CLOUD (opsional)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# WHATSAPP (format internasional tanpa '+', contoh 6281234567890)
WHATSAPP_NUMBER=

# DISCORD (opsional)
DISCORD_URL=

# SECURITY (untuk Vercel Cron reminders)
CRON_SECRET=
```

> Secret (`DATABASE_URL` dengan credential, `AUTH_SECRET`, `SMTP_PASSWORD`, `TURNSTILE_SECRET_KEY`, `CRON_SECRET`) **tidak pernah** dikirim ke browser dan **tidak pernah** di-commit.

---

## 5. GitHub Setup

1. Buat repository baru di GitHub (contoh: `wangstore`).
2. Push project:
   ```bash
   git init && git add -A && git commit -m "init: WangStore"
   git branch -M main
   git remote add origin git@github.com:<user>/wangstore.git
   git push -u origin main
   ```
3. Pastikan **`.env` / `.env.local` TIDAK masuk repository** (sudah di-ignore via `.gitignore`), sedangkan `.env.example` ikut ter-commit.
4. GitHub Actions sudah tersedia di `.github/workflows/` (typecheck, lint, build, test, audit deps) — aktif otomatis setelah push.

---

## 6. Vercel Deployment

1. **Login Vercel** → [vercel.com](https://vercel.com) → login dengan GitHub.
2. **Import Repository** → pilih `wangstore`.
3. **Framework Preset:** Next.js (terdeteksi otomatis).
4. **Build Settings:** gunakan default (`npm run build`). Jangan menambahkan command yang tidak diperlukan.
5. **Environment Variables** — tambahkan seluruh variabel §4, pisahkan per environment:
   - **Production**: `APP_URL` = domain production, `DATABASE_URL` production, dsb.
   - **Preview**: `APP_URL` preview (domain `*.vercel.app` otomatis), `DATABASE_URL` preview (disarankan database terpisah).
   - **Development**: lokal.
6. **Deploy** → klik `Deploy`.

Setelah selesai, aplikasi dapat diakses di `https://<project>.vercel.app`.

> **Catatan build:** saat `next build`, halaman diprerender dengan data awal dari JSON seed fallback sehingga build sukses tanpa koneksi DB. Pada runtime production, `DATABASE_URL` **wajib** ada — tanpa itu aplikasi gagal secara eksplisit (tidak ada fallback diam-diam).

---

## 7. Custom Domain

1. Di Vercel: **Project → Settings → Domains** → tambahkan `wangstore.example` dan/atau `www.wangstore.example`.
2. Ikuti **DNS records yang ditampilkan Vercel** (A/ALIAS/CNAME sesuai instruksi dashboard — jangan menebak record).
3. Tunggu propagasi (biasanya < 1 jam) hingga status **Valid**.
4. Update `APP_URL` & `NEXT_PUBLIC_APP_URL` di environment production → **Redeploy**.
5. Verifikasi: tautan email verification/reset memakai domain production (bukan localhost).

---

## 8. Vercel Cron (Reminder Layanan)

Reminder tidak memakai cron lokal (dilarang). Gunakan **Vercel Cron**:

1. Tambahkan di `vercel.json`:
   ```json
   {
     "crons": [
       { "path": "/api/cron/reminders", "schedule": "0 8 * * *" }
     ]
   }
   ```
2. Set `CRON_SECRET` di environment Vercel.
3. Endpoint memverifikasi `Authorization: Bearer <CRON_SECRET>`.
4. **Idempotent** — aman dijalankan berulang (unique constraint `(service_id, reminder_type)`).

Sampai cron aktif, admin dapat menjalankan reminder manual dari **Admin → Layanan → "Jalankan Reminder Sekarang"**.

---

## 9. Deployment Checklist

- [ ] Repository GitHub dibuat & project di-push
- [ ] `.env` / secret TIDAK masuk repository
- [ ] Cloud database project dibuat
- [ ] `database/schema.sql` dijalankan (`npm run db:migrate`)
- [ ] Seed dijalankan (`npm run db:seed`)
- [ ] Environment variables Vercel dikonfigurasi (Production/Preview/Development)
- [ ] `APP_URL` production dikonfigurasi (verification/reset URL benar)
- [ ] SMTP dikonfigurasi & test email lulus
- [ ] Build berhasil di Vercel
- [ ] Homepage, Register, Login, Logout berfungsi
- [ ] Server Builder + Pricing API berfungsi
- [ ] Order berhasil + WhatsApp redirect berfungsi
- [ ] Customer dashboard berfungsi
- [ ] Admin login + RBAC berfungsi
- [ ] Blog, Knowledge Base, Sitemap, Robots, Security headers aktif
- [ ] Custom domain dikonfigurasi
- [ ] Vercel Cron reminders diaktifkan (opsional tapi disarankan)

---

## 10. Troubleshooting

| Masalah | Periksa |
|---|---|
| Build gagal | `npm run build` lokal; pastikan `npx tsc --noEmit` dan `npm run lint` bersih |
| Koneksi database gagal | `DATABASE_URL` benar; gunakan pooled connection untuk serverless; `?sslmode=require`; IP/region pooler |
| Authentication gagal | `APP_URL` = domain production aktual; verification/reset URL tidak boleh localhost |
| Permission database error | RLS/policies Supabase: berikan akses via service role / grant ke role yang dipakai aplikasi; tabel dibuat via schema.sql |
| Environment variable tidak terbaca | Tambahkan di environment Vercel yang benar (Production ≠ Preview), lalu Redeploy |
| API jalan lokal tapi gagal di Vercel | Pastikan tidak memakai filesystem persistent, proses lokal, atau Node API yang tidak didukung serverless |
| Email tidak terkirim | SMTP belum dikonfigurasi / sender domain belum diverifikasi / port firewall provider |

---

## 11. Verifikasi Produksi

```bash
# Halaman publik
for p in / /about /server-builder /blog /knowledge-base /status /contact /terms /privacy /refund /sla; do
  curl -s -o /dev/null -w "$p → %{http_code}\n" https://<domain>$p
done

# API
curl -s https://<domain>/api/health
curl -s https://<domain>/api/pricing
curl -s "https://<domain>/api/packages?tier=medium"   # [] bila belum ada paket
```

Alur manual produksi: Register → Email verification → Login → Server Builder → Create Order → Order Confirmation → WhatsApp → Dashboard. Admin: Login → Dashboard → Create/Edit Product → Edit Pricing → Create Coupon → Edit CMS → Audit Log.
