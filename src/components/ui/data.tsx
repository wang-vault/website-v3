"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

export function Tabs({
  tabs,
  defaultValue,
  onChange,
}: {
  tabs: { value: string; label: string; count?: number }[];
  defaultValue: string;
  onChange?: (value: string) => void;
}) {
  const [active, setActive] = useState(defaultValue);
  return (
    <div role="tablist" aria-label="Tab" className="flex flex-wrap gap-1 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={active === tab.value}
          onClick={() => {
            setActive(tab.value);
            onChange?.(tab.value);
          }}
          className={`-mb-px rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
            active === tab.value
              ? "border-accent text-primary"
              : "border-transparent text-muted hover:text-secondary"
          }`}
        >
          {tab.label}
          {typeof tab.count === "number" && (
            <span className="ml-1.5 rounded-full bg-surface-muted px-1.5 py-0.5 text-xs tabular-nums">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  empty,
  loading,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: ReactNode;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-muted" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return <>{empty ?? <p className="py-8 text-center text-sm text-muted">Belum ada data.</p>}</>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className="px-4 py-3 font-medium">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-bg">
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-surface">
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 align-middle ${c.className ?? ""}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-secondary">
      <p className="text-xs text-muted">
        Menampilkan {from}–{to} dari {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Halaman sebelumnya"
          className="rounded-lg border border-border p-1.5 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-sm tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Halaman berikutnya"
          className="rounded-lg border border-border p-1.5 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Dropdown({
  trigger,
  items,
}: {
  trigger: ReactNode;
  items: { label: string; onClick: () => void; danger?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-xl border border-border bg-bg py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`block w-full px-4 py-2 text-left text-sm hover:bg-surface-muted ${
                item.danger ? "text-red-600" : "text-primary"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted">
      {items.map((item, i) => (
        <span key={item.label} className="flex items-center gap-1.5">
          {i > 0 && <ChevronDown className="h-3 w-3 -rotate-90 text-muted" aria-hidden />}
          {item.href ? (
            <a href={item.href} className="transition-colors hover:text-primary">
              {item.label}
            </a>
          ) : (
            <span aria-current="page" className="text-secondary">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
