"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/client/api";
import { formatIDR, formatDateTime } from "@/lib/utils/format";
import { OrderStatusBadge, ServiceStatusBadge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/ui/state";
import type { Order, OrderItem, ServiceInstance } from "@/lib/types";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<{ order: Order; items: OrderItem[]; services: ServiceInstance[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ order: Order; items: OrderItem[]; services: ServiceInstance[] }>(`/api/orders/${params.id}`).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setData(res.data);
      else setError(res.error?.message ?? "Pesanan tidak ditemukan.");
    });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;
  const { order } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/orders" className="text-sm text-muted hover:text-primary">← Semua Pesanan</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{order.order_number}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-sm text-muted">Dibuat {formatDateTime(order.created_at)}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Detail Layanan</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Tier</dt><dd>{order.tier_name}</dd></div>
            {order.package_name && <div className="flex justify-between"><dt className="text-muted">Paket</dt><dd>{order.package_name}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted">CPU</dt><dd>{order.cpu} vCore</dd></div>
            <div className="flex justify-between"><dt className="text-muted">RAM</dt><dd>{order.ram} GB</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Penyimpanan</dt><dd>{order.storage} GB</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Nama Server</dt><dd>{order.server_name}</dd></div>
            {order.notes && <div className="flex justify-between gap-3"><dt className="text-muted">Catatan</dt><dd className="text-right">{order.notes}</dd></div>}
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Harga</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Harga</dt><dd className="tabular-nums">{formatIDR(order.price_raw)}</dd></div>
            {order.coupon_code && (
              <div className="flex justify-between"><dt className="text-muted">Kupon {order.coupon_code}</dt><dd className="tabular-nums text-emerald-600">-{formatIDR(order.discount)}</dd></div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatIDR(order.total)}</dd></div>
          </dl>
        </section>
      </div>

      {data.services.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Layanan Terkait</h2>
          <ul className="mt-3 space-y-2">
            {data.services.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/dashboard/services/${s.id}`} className="text-sm font-medium hover:underline">
                  {s.name} ({s.service_number})
                </Link>
                <ServiceStatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
