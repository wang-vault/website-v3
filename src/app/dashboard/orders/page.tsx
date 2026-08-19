"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/api";
import { formatIDR, formatDateTime } from "@/lib/utils/format";
import { OrderStatusBadge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/state";
import type { Order } from "@/lib/types";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ orders: Order[] }>("/api/account/orders").then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setOrders(res.data.orders);
      else setError("Gagal memuat pesanan.");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pesanan</h1>
        <p className="mt-1 text-sm text-secondary">Riwayat dan status pesanan Anda.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!orders && !error && <LoadingState />}
      {orders && orders.length === 0 && (
        <EmptyState
          title="Belum ada pesanan"
          description="Pesan layanan pertama Anda melalui Server Builder."
          action={
            <Link href="/server-builder" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:opacity-90">
              Buat Server
            </Link>
          }
        />
      )}
      {orders && orders.length > 0 && (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <Link href={`/dashboard/orders/${o.id}`} className="text-sm font-semibold hover:underline">
                  {o.order_number}
                </Link>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {o.tier_name}{o.package_name ? ` — ${o.package_name}` : ""} · {o.cpu} vCore · {o.ram} GB · {o.storage} GB
                </p>
                <p className="text-xs text-muted">{formatDateTime(o.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{formatIDR(o.total)}</p>
                <OrderStatusBadge status={o.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
