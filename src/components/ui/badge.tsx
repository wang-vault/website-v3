import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "error" | "info" | "accent";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-secondary border border-border",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900",
  warning: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
  error: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900",
  info: "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900",
  accent: "bg-accent text-bg border border-accent",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className ?? ""}`}>
      {children}
    </span>
  );
}

const ORDER_TONE: Record<string, Tone> = {
  pending: "warning",
  awaiting_payment: "warning",
  paid: "info",
  processing: "info",
  completed: "success",
  cancelled: "error",
  expired: "neutral",
  refunded: "neutral",
};

const ORDER_LABEL: Record<string, string> = {
  pending: "Menunggu",
  awaiting_payment: "Menunggu Pembayaran",
  paid: "Dibayar",
  processing: "Diproses",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
  refunded: "Dikembalikan",
};

export function OrderStatusBadge({ status }: { status: string }) {
  return <Badge tone={ORDER_TONE[status] ?? "neutral"}>{ORDER_LABEL[status] ?? status}</Badge>;
}

const SERVICE_TONE: Record<string, Tone> = {
  pending: "warning",
  scheduled: "info",
  active: "success",
  suspended: "warning",
  expired: "neutral",
  cancelled: "error",
  terminated: "error",
};

const SERVICE_LABEL: Record<string, string> = {
  pending: "Menunggu",
  scheduled: "Dijadwalkan",
  active: "Aktif",
  suspended: "Ditangguhkan",
  expired: "Kedaluwarsa",
  cancelled: "Dibatalkan",
  terminated: "Dihentikan",
};

export function ServiceStatusBadge({ status }: { status: string }) {
  return <Badge tone={SERVICE_TONE[status] ?? "neutral"}>{SERVICE_LABEL[status] ?? status}</Badge>;
}

export const PACKAGE_TONE: Record<string, Tone> = {
  available: "success",
  maintenance: "warning",
  sold_out: "error",
  inactive: "neutral",
};

export const PACKAGE_LABEL: Record<string, string> = {
  available: "Tersedia",
  maintenance: "Pemeliharaan",
  sold_out: "Habis",
  inactive: "Nonaktif",
};

export function PackageStatusBadge({ status }: { status: string }) {
  return <Badge tone={PACKAGE_TONE[status] ?? "neutral"}>{PACKAGE_LABEL[status] ?? status}</Badge>;
}
