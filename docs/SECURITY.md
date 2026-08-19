# Keamanan WangStore

Dokumen ini menjelaskan model keamanan WangStore: lapisan pertahanan, praktik autentikasi, dan checklist produksi.

## 1. Prinsip

- **Server-side trust**: harga, diskon, status, role, activation/expiration/renewable TIDAK pernah dipercaya dari browser.
- **Defense in depth**: header keamanan → CSRF → rate limiting → session → RBAC → validasi → audit.
- **Jujur**: perlindungan DDoS bergantung pada provider jaringan; tidak ada klaim "Anti-DDoS 100%".

## 2. Lapisan Pertahanan

### 2.1 Security Headers (edge middleware + `next.config`)

- `Content-Security-Policy` — `default-src 'self'`; inline style diizinkan (Tailwind); Cloudflare Turnstile di-allowlist.
- `Strict-Transport-Security` — `max-age=63072000; includeSubDomains; preload` (production).
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`.

### 2.2 CSRF (double-submit cookie)

- Cookie `ws_csrf` (HttpOnly, SameSite=Lax, Secure di production) berisi `token.signature` (HMAC-SHA256 dengan `AUTH_SECRET`, Web Crypto — edge-safe).
- Request mutasi wajib mengirim `x-csrf-token` yang cocok dengan cookie.
- **Origin validation**: origin harus dari allowlist (`APP_URL`, localhost, `*.vercel.app`, `*.e2b.app`).
- Kegagalan → `403 CSRF_DENIED` / `403 ORIGIN_DENIED`.

### 2.3 Rate Limiting (serverless-compatible)

Per IP + endpoint (in-memory per instance):

| Endpoint | Limit/menit |
|---|---|
| Login | 10 |
| Register | 5 |
| Reset password / verify email | 5–10 |
| Order | 5 |
| Contact / ticket | 5 |
| Estimate / coupon validate | 20–30 |

> Catatan jujur: pada Vercel, batas berlaku per instance lambda. Untuk perlindungan global gunakan Cloudflare (rate limiting / WAF) sebagai lapisan tambahan.

### 2.4 Autentikasi & Sesi

- Password di-hash dengan **bcrypt cost 12**.
- **Login**: pesan error generik (tidak membocorkan keberadaan email), dummy hash comparison untuk email tak dikenal (timing-resistant).
- **Sesi**: token acak 32-byte, disimpan **hashed (SHA-256)** di DB, cookie HttpOnly/SameSite=Lax/Secure, TTL 30 hari, dapat di-revoke (logout).
- **Email verification & reset password**: JWT (jose, HS256) time-limited (24 jam / 1 jam) dan **single-use** (jti di tabel `auth_tokens`, ditandai `used_at`). URL memakai `APP_URL` production.
- Akun **belum terverifikasi** tidak mendapat akses penuh.

### 2.5 RBAC

- Role: `owner`, `admin`, `staff`, `customer`.
- Permission eksplisit (tabel `permissions`/`role_permissions`) — lihat matriks di ARCHITECTURE.md §4.5.
- **Diverifikasi di setiap API route admin** (`api()` helper: `auth: "admin"` + `permission`).
- Perubahan role/permission hanya Owner (`roles.manage`).

### 2.6 Validasi Input

- **Zod** di setiap endpoint (schema shared).
- **Sanitasi rekursif**: trim string, batas panjang, null-byte, batas kedalaman.
- **Payload limits**: 1 MB (json helper), 200 KB (order), 100 KB (CMS).
- Response error konsisten `{ success, error: { code, message } }` — **stack trace tidak pernah dikirim ke client**.

### 2.7 Audit Log

Dicatat untuk: login/logout, failed login, create/update/delete, perubahan pricing, kupon, order, customer, CMS, legal, role, maintenance, lifecycle (activation/expiration/renewal/manual extension), reminder run.

Kolom: `actor, action, resource, resourceId, ip, userAgent, metadata, created_at`. **Password/secret tidak pernah disimpan.**

### 2.8 Order Security

Alur: payload limit → auth → CSRF → Zod → sanitasi → normalisasi → authorization → business validation → **server-side pricing** → transaction → audit → response. Harga dari client **diabaikan sepenuhnya**.

## 3. Database Security

- Koneksi memakai kredensial least-privilege (service role hanya di server; anon key tidak dipakai untuk operasi sensitif).
- Semua authorization tetap diverifikasi **server-side** (tidak bergantung pada RLS saja).
- Supabase RLS dapat diaktifkan sebagai lapisan tambahan; dokumen berikut contoh kebijakan minimal yang aman:
  ```sql
  -- contoh (sesuaikan dengan kebutuhan):
  alter table users enable row level security;
  create policy "users read own" on users for select using (auth.uid() = id);
  ```
- Audit log hanya dapat dibaca role berizin (`audit.view`).

## 4. Bot Protection (opsional)

Cloudflare Turnstile didukung untuk register/login/contact/order:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` di environment.
- Verifikasi dilakukan server-side; tanpa konfigurasi, proteksi tidak aktif (jujur).

## 5. DDoS Disclosure

> Perlindungan DDoS bergantung pada kapasitas dan kemampuan provider jaringan. WangStore tidak menjanjikan perlindungan DDoS tanpa batas dan dilarang menulis "Anti-DDoS 100%".

## 6. Checklist Produksi

- [ ] `AUTH_SECRET` acak (openssl rand -base64 48)
- [ ] `DATABASE_URL` hanya di server (Vercel env), tidak di client
- [ ] `APP_URL` = domain production
- [ ] SMTP dikonfigurasi & diverifikasi (verification/reset)
- [ ] Security headers aktif (cek via curl -I)
- [ ] `/api/admin/*` menolak non-staf (401/403)
- [ ] Private routes noindex (`/dashboard`, `/admin`, `/order/`, `/login`)
- [ ] Rate limiting aktif pada login/register/reset/order/contact
- [ ] Audit log berjalan (lihat Admin → Audit Log)
- [ ] `npm run audit:deps` bersih
