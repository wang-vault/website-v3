# Laporan Verifikasi WangStore

Dokumen ini mencatat **apa yang sudah diverifikasi** dan **apa yang belum** pada build ini, sesuai prinsip kejujuran proyek.

Tanggal verifikasi: 2026-08-20

---

## ✅ Terverifikasi (dijalankan di environment ini)

| # | Pemeriksaan | Hasil |
|---|---|---|
| 1 | `npm run typecheck` (`tsc --noEmit`) | ✅ 0 error |
| 2 | `npm run lint` (next lint) | ✅ 0 error / 0 warning |
| 3 | `npm test` (vitest) | ✅ 42/42 lulus |
| 4 | `npm run build` (production build) | ✅ sukses (97 halaman statis) |
| 5 | HTTP smoke test (`tests/smoke.mjs`) | ✅ 36/36 lulus |
| 6 | E2E HTTP flow (`tests/e2e.mjs`) | ✅ 18/18 lulus |
| 7 | Halaman publik (/, /about, /server-builder, /blog, /kb, /status, /contact, /terms, /privacy, /refund, /sla, dll.) | ✅ HTTP 200 |
| 8 | `/dashboard` & `/admin` tanpa login | ✅ redirect ke /login |
| 9 | Register → Email verification (devLink, SMTP off) → Login | ✅ |
| 10 | Server Builder: pricing API 2/4/20 → Rp50.000; 4/8/40 → Rp85.000 | ✅ |
| 11 | Order API: harga server-side, client price diabaikan | ✅ |
| 12 | Order confirmation page (noindex) | ✅ |
| 13 | Customer dashboard (dengan sesi) | ✅ |
| 14 | RBAC: admin API tanpa auth → 401; customer → 403; owner → 200 | ✅ |
| 15 | CSRF: mutasi tanpa token → 403; origin asing → 403 | ✅ |
| 16 | Kupon: valid → diskon; expired → ditolak; limit → ditolak; fake discount → diabaikan | ✅ |
| 17 | Paket Medium/High: dibuat via Owner flow → muncul di builder → dipakai order API; maintenance → tidak bisa dipesan | ✅ |
| 18 | Lifecycle: scheduled/active/expired dari waktu server; renewal rules; reminder idempotent | ✅ |
| 19 | Security headers (CSP, X-Frame-Options, nosniff, dll.) | ✅ aktif |
| 20 | Sitemap & robots | ✅ |
| 21 | Production runtime TANPA DATABASE_URL → gagal eksplisit (tidak ada fallback diam-diam) | ✅ (HTTP 500 terarah, tanpa data palsu) |

## ⬜ Belum Terverifikasi (membutuhkan environment eksternal)

| Item | Alasan |
|---|---|
| **Deployment Vercel aktual** | Membutuhkan akun Vercel + repository GitHub publik. Panduan lengkap: `docs/DEPLOYMENT.md`. |
| **PostgreSQL cloud (Supabase/Neon/dll.)** | Tidak ada kredensial database cloud di environment ini. `database/schema.sql` + `npm run db:migrate` + `npm run db:seed` disiapkan dan didokumentasikan, tetapi belum dijalankan terhadap provider nyata. |
| **SMTP terkirim (email verification/reset)** | SMTP belum dikonfigurasi di environment ini. Kode mengirim email hanya jika `SMTP_HOST/USER/PASSWORD` terisi, dan **tidak pernah mengklaim terkirim** bila tidak. Pada development, tautan verifikasi/reset ditampilkan di respons API. |
| **Vercel Cron reminders** | Butuh deployment Vercel + `CRON_SECRET`. Endpoint `/api/cron/reminders` + dokumentasi `vercel.json` sudah disiapkan; admin dapat menjalankan reminder manual. |
| **Custom domain** | Butuh deployment Vercel. |
| **WhatsApp terkirim** | Hanya URL `wa.me` yang dibuat (open link). Nomor belum dikonfigurasi → `whatsappUrl: null` ditampilkan jujur. |
| **Cloudflare Turnstile** | Opsional; site key/secret belum diisi. |

## Catatan Jujur

1. **JSON datastore lokal** dipakai untuk development/testing dan untuk static generation saat `next build` tanpa `DATABASE_URL`. Pada **runtime production/preview**, tanpa `DATABASE_URL`, aplikasi gagal secara eksplisit (HTTP 500 + pesan konfigurasi) — tidak ada fallback diam-diam.
2. **User pertama yang mendaftar menjadi Owner** — memudahkan deployment dan diuji di acceptance tests.
3. **Rate limiter** bersifat in-memory per instance (sesuai batasan serverless); untuk perlindungan global disarankan Cloudflare (didokumentasikan).
4. **Estimasi performa** adalah estimasi deterministik — bukan SLA/jaminan. Uptime aktual tidak ditampilkan (menunggu monitoring) — tidak ada angka uptime palsu.
5. **Testimoni, insiden, jadwal maintenance, dan statistik** di-seed kosong — tidak ada data palsu; empty state jujur ditampilkan.
