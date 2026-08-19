# Workflow Templates

Repository ini di-push menggunakan GitHub App yang **tidak memiliki izin `workflows`**,
sehingga `.github/workflows/` tidak dapat di-commit dari environment ini.

**Aktivasi CI (manual, sekali saja):**

1. Clone repository ke komputer Anda (atau buka di github.dev).
2. Salin template ke lokasi aktif:

```bash
mkdir -p .github/workflows
cp .github/workflow-templates/ci.yml .github/workflows/ci.yml
```

3. Push ke `main`:

```bash
git add .github/workflows/ci.yml
git commit -m "ci: aktifkan GitHub Actions (typecheck, lint, build, test, audit, CodeQL)"
git push
```

> Catatan: GitHub Actions harus diizinkan di **Settings → Actions → General → Allow**.
> Jika organisasi Anda menonaktifkan Actions, gunakan environment CI lain dengan perintah yang sama
> seperti di template: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run audit:deps`.

Template: `ci.yml` — berisi jobs:
- **quality**: typecheck, lint, test (vitest), production build
- **security**: `npm audit` + GitHub CodeQL (javascript-typescript)
