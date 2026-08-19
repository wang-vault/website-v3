export default function Loading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-16 sm:px-6" aria-busy="true" aria-label="Memuat halaman">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-muted" />
      <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-surface-muted" />
      <div className="h-4 w-3/4 animate-pulse rounded bg-surface-muted" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="h-40 animate-pulse rounded-2xl bg-surface-muted" />
        <div className="h-40 animate-pulse rounded-2xl bg-surface-muted" />
        <div className="h-40 animate-pulse rounded-2xl bg-surface-muted" />
      </div>
    </div>
  );
}
