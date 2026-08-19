"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/api";
import { formatIDR } from "@/lib/utils/format";
import { StatCard } from "@/components/ui/card";
import { OrderStatusBadge, ServiceStatusBadge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { ArrowRight } from "lucide-react";
import type { Order, ServiceInstance } from "@/lib/types";

export default function DashboardOverviewPage() {
  const [data, setData] = useState<{ orders: Order[]; services: ServiceInstance[]; unread: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ordersRes, servicesRes, notifRes] = await Promise.all([
        apiFetch<{ orders: Order[] }>("/api/account/orders"),
        apiFetch<{ services: ServiceInstance[] }>("/api/services"),
        apiFetch<{ unread: number }>("/api/notifications"),
      ]);
      if (cancelled) return;
      if (ordersRes.success && servicesRes.success && notifRes.success) {
        setData({
          orders: ordersRes.data?.orders ?? [],
          services: servicesRes.data?.services ?? [],
          unread: notifRes.data?.unread ?? 0,
        });
      } else {
        setError("Gagal memuat data dashboard.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <LoadingState label="Memuat dashboard…" />;

  const totalSpent = data.orders.filter((o) => ["paid", "processing", "completed"].includes(o.status)).reduce((a, o) => a + Number(o.total), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ringkasan</h1>
        <p className="mt-1 text-sm text-secondary">Pantau pesanan dan layanan Anda di satu tempat.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Pesanan" value={data.orders.length} />
        <StatCard label="Layanan Aktif" value={data.services.filter((s) => s.status === "active").length} />
        <StatCard label="Notifikasi Belum Dibaca" value={data.unread} />
        <StatCard label="Total Belanja" value={formatIDR(totalSpent)} />
      </div>

      <section aria-label="Pesanan terbaru">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pesanan Terbaru</h2>
          <Link href="/dashboard/orders" className="flex items-center gap-1 text-sm font-medium underline underline-offset-2">
            Semua <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        {data.orders.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="Belum ada pesanan"
              description="Buat pesanan pertama Anda melalui Server Builder."
              action={
                <Link href="/server-builder" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:opacity-90">
                  Buat Server
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
            {data.orders.slice(0, 5).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                <div>
                  <Link href={`/dashboard/orders/${o.id}`} className="text-sm font-semibold hover:underline">
                    {o.order_number}
                  </Link>
                  <p className="text-xs text-muted">
                    {o.tier_name}{o.package_name ? ` — ${o.package_name}` : ""} · {formatIDR(o.total)}
                  </p>
                </div>
                <OrderStatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Layanan terbaru">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Layanan Saya</h2>
          <Link href="/dashboard/services" className="flex items-center gap-1 text-sm font-medium underline underline-offset-2">
            Semua <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        {data.services.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border bg-surface px-5 py-8 text-center text-sm text-secondary">
            Layanan akan muncul di sini setelah pesanan dikonfirmasi.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
            {data.services.slice(0, 5).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                <div>
                  <Link href={`/dashboard/services/${s.id}`} className="text-sm font-semibold hover:underline">
                    {s.name}
                  </Link>
                  <p className="text-xs text-muted">{s.service_number} · berakhir {new Date(s.expires_at).toLocaleDateString("id-ID")}</p>
                </div>
                <ServiceStatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
