import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-sm font-medium text-muted">Error 404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Halaman tidak ditemukan</h1>
      <p className="mt-3 max-w-md text-secondary">
        Halaman yang Anda cari tidak ada atau telah dipindahkan. Periksa kembali alamatnya, atau kembali ke beranda.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
        >
          Kembali ke Beranda
        </Link>
        <Link
          href="/server-builder"
          className="inline-flex items-center justify-center rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-secondary transition-colors hover:bg-surface-muted"
        >
          Server Builder
        </Link>
      </div>
    </div>
  );
}
