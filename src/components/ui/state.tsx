import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-muted">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden />}
      </span>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-secondary">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-6 py-14 text-sm text-secondary" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorState({ title = "Terjadi kesalahan", message, retry }: { title?: string; message?: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-secondary">{message}</p>}
      {retry && (
        <button type="button" onClick={retry} className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted">
          Coba Lagi
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-muted ${className ?? "h-4 w-full"}`} aria-hidden />;
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  );
}
