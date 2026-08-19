# Arsitektur WangStore

Dokumen ini menjelaskan arsitektur teknis WangStore: stack, domain model, modul shared, permission matrix, dan keputusan desain.

## 1. Prinsip

1. **Satu sumber kebenaran.** PostgreSQL cloud untuk data; waktu server/database untuk lifecycle; modul shared untuk pricing/validasi/authorization/business rules. Browser hanya untuk input & state non-sensitive.
2. **Server-authoritative.** Harga, diskon, status, activation/expiration, dan renewable TIDAK pernah dipercaya dari client.
3. **Serverless-compatible.** Target deployment Vercel + PostgreSQL cloud + SMTP. Tidak ada VPS, Docker, Nginx, PM2, systemd, cron lokal, atau filesystem persistent.
4. **Kejujuran.** Tidak ada data palsu: testimoni, uptime, hardware, statistik, atau "pembayaran sukses" fiktif.

## 2. Stack

| Lapisan | Teknologi |
|---|---|
| Framework | Next.js 14 App Router (Server Components diutamakan) |
| Bahasa | TypeScript strict (dilarang `any`) |
| Styling | Tailwind CSS (sistem warna hitam/putih/abu) |
| Validasi | Zod (shared) |
| Auth token | jose (JWT HS256, time-limited, single-use) |
| Password | bcryptjs cost 12 |
| Database | PostgreSQL cloud (postgres.js) + JSON fallback dev |
| Email | nodemailer (SMTP) |
| Markdown | react-markdown + remark-gfm |
| Ikon | lucide-react |

## 3. Struktur Project

```
src/
  app/                    # halaman (App Router) + API routes
  components/             # UI components (client & server)
    ui/                   # design system (Button, Input, Card, Badge, Modal…)
    builder/              # Server Builder + order form
    admin/                # helper halaman admin
  lib/
    auth/                 # password, session, tokens (JWT)
    db/                   # postgres.ts, json.ts, types.ts, index.ts, seed.ts
    pricing/              # PRICING ENGINE (shared UI + API)
    services/             # lifecycle, reminders (server time = kebenaran)
    store/                # domain repositories (catalog, orders, coupons, services, users)
    security/             # CSRF, sanitasi, payload limits, origin validation
    rate-limit/           # rate limiting (per instance, serverless)
    api/helpers.ts        # wrapper route: auth + RBAC + CSRF + ratelimit + maintenance
    validation/           # Zod schemas (shared)
    cms/                  # generic CMS resource map
    whatsapp/             # pesan order ke WhatsApp
    mail/                 # SMTP (verification/reset)
    settings/             # pengaturan platform
    audit/                # audit log
    utils/                # edge-safe utilities
  types.ts                # seluruh domain types
  middleware.ts           # edge: security headers, CSRF cookie, noindex
database/
  schema.sql              # source of truth schema produksi
tests/                    # unit + acceptance + smoke + e2e
scripts/                  # db:migrate, db:seed
docs/                     # dokumentasi
```

## 4. Domain Model

### 4.1 Katalog & Harga

- `server_tiers` — Low (mode `custom`), Medium & High (mode `package`). Status/visibility/orderable/performance_factor.
- `pricing_rules` — formula Tier Low: `base`, `per_core`, `per_gb_ram`, `per_gb_storage`, `min_price`, `max_price`, `rounding`, batas CPU/RAM/Storage (min/max/step). **Dikelola via Admin Panel, bukan hardcoded.**
- `server_packages` — paket Medium/High yang **hanya dibuat Owner**. Tidak ada paket default hardcoded; tanpa paket di DB, UI menampilkan empty state jujur.
- `vps_packages` + `vps_locations` — katalog VPS database-driven.
- `products` — katalog terpadu (satu baris per paket) untuk keperluan order.

### 4.2 Pricing Engine (`src/lib/pricing`)

Satu-satunya sumber kebenaran harga. Dipakai oleh Server Builder (client) dan Order API (server).

- Formula Low: `base + CPU×perCore + RAM×perGbRam + Storage×perGbStorage`, dibulatkan ke `rounding`, dijepit ke `[minPrice, maxPrice]`.
- Normalisasi: nilai di luar batas dipangkas ke **safety limit absolut** (CPU 1–16, RAM 1–32, Storage 5–160), lalu dijepit ke rentang aturan DB dan di-snap ke step.
- Estimasi performa: deterministik (TPS, pemain, beban CPU/RAM, rekomendasi plugin, grade) — diberi label **"Estimasi"**, bukan SLA.

### 4.3 Order

`orders` + `order_items` + `coupon_usages`. Status order: `pending → awaiting_payment → paid → processing → completed` (+ `cancelled / expired / refunded`), transisi divalidasi (`canTransition`).

Alur `POST /api/orders`: payload limit → CSRF → Zod → sanitasi → normalisasi → verify tier → reject ongoing → verify paket (Medium/High/VPS) → verify kupon → **harga server-side** → transaction (order + item + coupon usage + audit) → WhatsApp URL.

### 4.4 Service Lifecycle (`src/lib/services`)

`service_instances` status: `pending / scheduled / active / suspended / expired / cancelled / terminated`.

- **Derived status** dihitung dari waktu server: `activation_at <= now < expires_at` → `active`; `activation_at` masa depan → `scheduled`; `expires_at` terlewati → `expired`.
- **Renewal**: layanan aktif → `expires_at + durasi`; expired → `server time + durasi`. Harga dihitung server-side dari paket yang berlaku. Renewal membuat `orders` (source=renewal) + `service_renewals`; `expires_at` diperpanjang hanya setelah konfirmasi pembayaran.
- **Manual extension** admin: wajib reason, tercatat audit (sebelum/sesudah activation & expiration).
- **Reminder**: `service_reminders` dengan **unique constraint `(service_id, reminder_type)`** → idempotent. Dijalankan via cron serverless (`/api/cron/reminders`) atau tombol admin. Kanal: dashboard (selalu), email (hanya jika SMTP dikonfigurasi), WhatsApp (belum tersedia — jujur).

### 4.5 RBAC

Role: `owner > admin > staff` (hierarchy) + `customer` (tanpa permission). Authorization berbasis **permission eksplisit** (tabel `permissions` + `role_permissions`), diverifikasi di **setiap** API route admin.

Permission matrix lengkap di `scripts/seed` / tabel `permissions`. Poin penting:

| Aksi | Role |
|---|---|
| Kelola paket Medium/High (create/update/archive/delete) | **Owner saja** (`packages.manage`) |
| Ubah formula harga & batas Low | Owner/Admin (`pricing.manage`) |
| Kelola role & permission | **Owner saja** (`roles.manage`) |
| Kelola VPS packages | Owner/Admin (`vps.manage`) |
| Konfirmasi pembayaran order | Owner/Admin (`orders.update`) |
| Lihat audit log | Owner/Admin (`audit.view`) |
| Staff | Hanya aksi pandang + balas tiket |

### 4.6 CMS Generic

Satu endpoint `api/admin/cms/[resource]` + resource map (`src/lib/cms/resources.ts`): collection, schema Zod, whitelist editable fields, min role. Resource: `pages, faq, testimonials, blog, knowledgeBase, legal, announcements, incidents, maintenance`. Domain sensitif (order, payment, auth, lifecycle) **tidak** dipaksakan ke generic CRUD.

## 5. Data Layer

- `src/lib/db/postgres.ts` — driver PostgreSQL (postgres.js), singleton, pool kecil, serverless-friendly.
- `src/lib/db/json.ts` — **fallback development saja**: mini SQL engine (SELECT/INSERT/UPDATE/DELETE + WHERE), atomic write (temp+rename), serialized write queue, transaction snapshot, auto-seed.
- `src/lib/db/index.ts` — pemilihan driver:
  - `DATABASE_URL` terisi → PostgreSQL (semua environment).
  - Kosong + development/test → JSON fallback.
  - Kosong + production/preview → **gagal eksplisit** (error konfigurasi aman).
  - Kosong + `next build` → JSON fallback untuk keperluan static generation.

## 6. Keamanan (ringkas)

Lihat [docs/SECURITY.md](SECURITY.md) untuk detail. Lapisan: security headers (edge middleware) → CSRF double-submit + Origin validation → rate limiting → auth session → RBAC permission → Zod + sanitasi → audit log.

## 7. Testing

- `tests/pricing.test.ts` — formula, normalisasi, safety limits, estimasi.
- `tests/acceptance-builder.test.ts` — order API, paket Medium/High via Owner flow, harga server-side.
- `tests/lifecycle.test.ts` — status lifecycle, renewal rules, reminder idempotent, authorization.
- `tests/security.test.ts` — CSRF, RBAC, kupon.
- `tests/smoke.mjs` — HTTP smoke (public pages 200, /dashboard redirect, API).
- `tests/e2e.mjs` — E2E penuh via HTTP.

## 8. Keputusan Desain Penting

- **Tidak ada package Medium/High default** di source code — semuanya dari database (Owner yang membuat).
- **Tidak ada region multiplier, add-on, diskon siklus** — sesuai spesifikasi.
- **`waktu server`** adalah kebenaran untuk semua transisi lifecycle; browser tidak pernah mengirim `expires_at` yang dipercaya.
- **User pertama = Owner** (memudahkan deployment; didokumentasikan).
- **Rate limiter in-memory per instance** — pada Vercel bersifat per-lambda; untuk perlindungan global direkomendasikan Cloudflare (didokumentasikan, bukan klaim berlebihan).
