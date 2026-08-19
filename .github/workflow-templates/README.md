# Workflow Templates

`ci.yml` di `.github/workflows/` aktif otomatis setelah repository dipush ke GitHub.

Bila organisasi Anda menonaktifkan GitHub Actions, salin template ini ke
`.github/workflows/` dan aktifkan secara manual:

```bash
mkdir -p .github/workflows
cp .github/workflow-templates/ci.yml .github/workflows/ci.yml
```

Workflow memerlukan permission GitHub Actions (Settings → Actions → General → Allow).
