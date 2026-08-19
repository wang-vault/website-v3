# API WangStore

Semua endpoint mengembalikan JSON konsisten:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "...", "message": "...", "details": "..." } }
```

Format error: `400 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 FORBIDDEN/CSRF_DENIED/ORIGIN_DENIED`, `404 NOT_FOUND`, `409` (konflik bisnis), `413 PAYLOAD_TOO_LARGE`, `422` (paket/tier tidak valid), `429 RATE_LIMITED`, `503 MAINTENANCE/DB_UNAVAILABLE`. Stack trace tidak pernah dikirim.

**Keamanan wajib untuk mutasi:** cookie CSRF (`ws_csrf`, di-set oleh middleware) + header `x-csrf-token`. Endpoint admin: sesi (cookie) atau `Authorization: Bearer <token>` + permission RBAC.

---

## Publik

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/health` | Status aplikasi + datastore |
| GET | `/api/pricing` | Tier + aturan harga Low (satu sumber kebenaran) |
| POST | `/api/pricing/estimate` | Estimasi harga & performa Low (normalisasi server-side) |
| GET | `/api/packages?tier=medium\|high` | Paket Medium/High dari database (kosong bila belum dibuat Owner) |
| GET | `/api/vps` | Paket VPS orderable |
| GET | `/api/vps/[id]` | Detail paket VPS |
| GET | `/api/products` | Katalog produk orderable |
| GET | `/api/coupons` | Kupon aktif yang sedang berlaku |
| POST | `/api/coupons/validate` | Validasi kupon (diskon dihitung server) |
| POST | `/api/orders` | **Buat pesanan** (harga server-side) |
| GET | `/api/orders/[id]` | Detail pesanan (UUID; pemilik/staf) |
| GET | `/api/blog?q=&category=&tag=&page=` | Blog + pencarian |
| GET | `/api/blog/[slug]` | Artikel + related |
| GET | `/api/knowledge-base?q=&category=` | Knowledge base + pencarian |
| GET | `/api/knowledge-base/[slug]` | Artikel KB + related |
| GET | `/api/faq` | FAQ aktif |
| GET | `/api/testimonials` | Testimoni published |
| GET | `/api/status` | Status platform, insiden, maintenance |
| GET | `/api/content/pages\|legal\|announcements` | Konten CMS publik |
| POST | `/api/contact` | Pesan kontak → tiket (rate limited) |
| POST | `/api/csrf` | Token CSRF (GET sebenarnya — lihat route) |

### POST /api/orders — body

```jsonc
{
  "tierSlug": "low | medium | high | vps",
  "cpu": 4, "ram": 8, "storage": 40,          // wajib untuk low
  "packageId": "uuid",                        // wajib untuk medium/high
  "vpsPackageId": "uuid",                     // wajib untuk vps
  "name": "Nama", "whatsapp": "0812...", "email": "a@b.c",
  "serverName": "Server Saya", "notes": "", "couponCode": "HEMAT10",
  "accepted": true                            // persetujuan kebijakan (wajib)
}
```

Harga dari body **diabaikan**. Respons: `{ orderId, orderNumber, status, total, discount, priceRaw, whatsappUrl }`.

---

## Auth

| Method | Path | Keterangan |
|---|---|---|
| POST | `/api/auth/register` | Daftar (user pertama = Owner). Mengirim email verifikasi bila SMTP aktif; di dev mengembalikan `devLink` |
| POST | `/api/auth/login` | Login → set cookie sesi; di non-prod mengembalikan `sessionToken` |
| POST | `/api/auth/logout` | Logout + revoke sesi |
| GET | `/api/auth/me` | User saat ini |
| POST | `/api/auth/verify-email` | `{ token }` — single-use |
| POST | `/api/auth/resend-verification` | `{ email }` |
| POST | `/api/auth/forgot-password` | `{ email }` (respons seragam) |
| POST | `/api/auth/reset-password` | `{ token, password }` |
| POST | `/api/auth/change-password` | `{ currentPassword, newPassword }` (auth) |
| GET/PATCH | `/api/auth/profile` | Profil (auth) |

## Akun (auth wajib)

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/account/orders` | Riwayat pesanan |
| GET/POST | `/api/account/saved-configs` | Konfigurasi tersimpan |
| PATCH/DELETE | `/api/account/saved-configs/[id]` | Ubah/hapus konfigurasi |
| GET | `/api/notifications` | Notifikasi + unread |
| POST | `/api/notifications/[id]` | Tandai dibaca |
| GET | `/api/services` | Layanan saya (status di-refresh dari waktu server) |
| GET | `/api/services/[id]` | Detail + renewal history |
| POST | `/api/services/[id]/renew` | `{ durationDays }` → renewal order |
| GET | `/api/services/[id]/reminders` | Daftar reminder |
| GET/POST | `/api/tickets` | Tiket saya / buat tiket |
| GET | `/api/tickets/[id]` | Detail tiket (pemilik/staf) |
| POST | `/api/tickets/[id]` | Tutup tiket (pemilik) |
| POST | `/api/tickets/[id]/messages` | Balas tiket |

## Admin (auth + RBAC; permission disebutkan)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/admin/overview` | `dashboard.view` |
| GET | `/api/admin/orders` | `orders.view` |
| GET/PATCH | `/api/admin/orders/[id]` | `orders.view` / `orders.update` (transisi divalidasi; `→ paid` membuat layanan) |
| GET | `/api/admin/customers` | `customers.view` |
| GET/PATCH | `/api/admin/customers/[id]` | `customers.view` / `customers.update` |
| GET | `/api/admin/services` | `services.view` |
| GET/PATCH/POST | `/api/admin/services/[id]` | `services.view` / `services.manage` (extend/notify/refresh) |
| GET/POST | `/api/admin/vps-packages` | `vps.view` / `vps.manage` |
| PATCH/DELETE | `/api/admin/vps-packages/[id]` | `vps.manage` |
| GET/POST | `/api/admin/locations`; PATCH/DELETE `[id]` | `vps.view` / `vps.manage` |
| GET/POST | `/api/admin/packages`; PATCH/DELETE `[id]` | `packages.view` / `packages.manage` (**Owner**) |
| GET/PATCH | `/api/admin/pricing` | `pricing.view` / `pricing.manage` |
| GET/POST | `/api/admin/coupons`; PATCH/DELETE `[id]` | `coupons.view` / `coupons.manage` |
| GET | `/api/admin/tickets` | `tickets.view` |
| GET/PATCH | `/api/admin/tickets/[id]` | `tickets.view` / `tickets.manage` |
| GET/POST | `/api/admin/cms/[resource]`; PATCH/DELETE `[resource]/[id]` | `content.view` / `content.manage` |
| GET | `/api/admin/analytics` | `analytics.view` |
| GET | `/api/admin/audit-logs` | `audit.view` |
| GET | `/api/admin/users`; PATCH `[id]` | `users.manage` (+ `roles.manage` untuk ubah role) |
| GET/PATCH | `/api/admin/roles` | `roles.manage` (**Owner**) |
| GET/PATCH | `/api/admin/settings` | `settings.manage` |
| GET/POST | `/api/admin/reminders` | `services.reminders` |

### PATCH /api/admin/orders/[id]

```jsonc
{ "status": "paid", "reason": "...",           // transisi divalidasi
  "activationAt": "2026-09-01T08:00:00.000Z",  // hanya untuk paid (opsional)
  "durationDays": 30, "renewable": true }
```

### PATCH /api/admin/services/[id]

```jsonc
{ "status": "active", "activationAt": "...", "expiresAt": "...", "renewable": true, "reason": "wajib utk audit" }
```

### POST /api/admin/services/[id] — aksi

```jsonc
{ "action": "extend", "newExpiresAt": "...", "reason": "..." }
{ "action": "notify", "reason": "pesan ke pelanggan" }
{ "action": "refresh-status" }
```

## Cron

| Method | Path | Keterangan |
|---|---|---|
| POST | `/api/cron/reminders` | Jalankan reminder jatuh tempo (idempotent). Wajib `Authorization: Bearer <CRON_SECRET>` |

## CMS Resource Map

`pages | faq | testimonials | blog | knowledgeBase | legal | announcements | incidents | maintenance` — satu handler generic (lihat ARCHITECTURE.md §4.6).
