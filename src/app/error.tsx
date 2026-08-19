"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-sm font-medium text-muted">Terjadi kesalahan</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ada yang tidak beres</h1>
      <p className="mt-3 max-w-md text-secondary">
        Terjadi kesalahan saat memuat halaman. Silakan coba lagi, atau kembali ke beranda.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
        >
          Coba Lagi
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-secondary transition-colors hover:bg-surface-muted"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
