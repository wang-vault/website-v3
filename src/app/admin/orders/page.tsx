"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/api";
import { formatIDR, formatDateTime } from "@/lib/utils/format";
import { OrderStatusBadge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { Pagination } from "@/components/ui/data";
import { AdminPageHeader, ORDER_STATUS_LABEL } from "@/components/admin/admin-page";
import type { Order } from "@/lib/types";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    apiFetch<{ orders: Order[]; total: number }>(`/api/admin/orders?${params.toString()}`).then((res) => {
      if (res.success && res.data) {
        setOrders(res.data.orders);
        setTotal(res.data.total);
      } else setError(res.error?.message ?? "Gagal memuat pesanan.");
    });
  }, [page, status, q]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Pesanan"
        description="Semua pesanan dari seluruh pelanggan."
      />
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Cari nomor/nama/email…"
          className="w-56 rounded-lg border border-border bg-bg px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-accent"
          aria-label="Cari pesanan"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm"
          aria-label="Filter status"
        >
          <option value="">Semua status</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!orders && !error && <LoadingState />}
      {orders && orders.length === 0 && <EmptyState title="Belum ada pesanan" description="Pesanan akan muncul di sini." />}
      {orders && orders.length > 0 && (
        <>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-surface-muted">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{o.order_number}</p>
                    <p className="truncate text-xs text-muted">
                      {o.customer_name} · {o.tier_name}{o.package_name ? ` — ${o.package_name}` : ""}
                    </p>
                    <p className="text-xs text-muted">{formatDateTime(o.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums">{formatIDR(o.total)}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} total={total} pageSize={pageSize} onPage={setPage} />
        </>
      )}
    </div>
  );
}
