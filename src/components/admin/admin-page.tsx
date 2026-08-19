"use client";

import type { ReactNode } from "react";

export function AdminPageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

export function FormCard({ title, children, onSubmit }: { title: string; children: ReactNode; onSubmit?: (e: React.FormEvent) => void }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </form>
  );
}

/** Peta status order ke label Bahasa Indonesia. */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  awaiting_payment: "Menunggu Pembayaran",
  paid: "Dibayar",
  processing: "Diproses",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
  refunded: "Dikembalikan",
};

export const SERVICE_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  scheduled: "Dijadwalkan",
  active: "Aktif",
  suspended: "Ditangguhkan",
  expired: "Kedaluwarsa",
  cancelled: "Dibatalkan",
  terminated: "Dihentikan",
};

export const PACKAGE_STATUS_LABEL: Record<string, string> = {
  available: "Tersedia",
  maintenance: "Pemeliharaan",
  sold_out: "Habis",
  inactive: "Nonaktif",
};
