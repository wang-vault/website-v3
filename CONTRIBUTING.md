# Kontribusi ke WangStore

Terima kasih sudah ingin berkontribusi! Dokumen ini berisi panduan singkat.

## Prasyarat

- Node.js >= 18.17
- Pemahaman dasar Next.js App Router, TypeScript, PostgreSQL

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Standar Kode

- TypeScript strict — **dilarang `any`**.
- Server Components diutamakan; `"use client"` hanya bila butuh interaktivitas.
- Semua teks UI dalam Bahasa Indonesia yang natural.
- Tanpa placeholder / data palsu / fitur pura-pura.
- Tanpa `TODO` / `FIXME` di kode yang dikirim.
- Semua harga & business rule di modul shared (`src/lib/pricing`, `src/lib/services`), bukan duplikasi client-server.

## Sebelum Push

```bash
npm run typecheck   # 0 error
npm run lint        # 0 warning/error
npm test            # semua test lulus
npm run build       # production build sukses
```

Tambah test untuk setiap perubahan bisnis penting (lihat `tests/`).

## Alur PR

1. Fork & buat branch (`feat/...`, `fix/...`).
2. Buat perubahan + test.
3. Push dan buka Pull Request menggunakan template yang tersedia (`.github/pull_request_template.md`).
4. CI (`.github/workflows/ci.yml`) harus hijau: typecheck, lint, build, test, audit deps.

## Melaporkan Bug / Permintaan Fitur

Gunakan issue template di `.github/ISSUE_TEMPLATE/`.
