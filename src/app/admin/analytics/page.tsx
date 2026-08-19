"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { formatIDR } from "@/lib/utils/format";
import { StatCard } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/state";
import { AdminPageHeader } from "@/components/admin/admin-page";

interface AnalyticsData {
  revenueByDay: { date: string; revenue: number }[];
  popularPackages: { name: string; count: number }[];
  couponUsage: { code: string; count: number; totalDiscount: number }[];
  orderStatusCounts: Record<string, number>;
  summary: { totalOrders: number; totalRevenue: number; totalDiscount: number };
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  awaiting_payment: "Menunggu Pembayaran",
  paid: "Dibayar",
  processing: "Diproses",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
  refunded: "Dikembalikan",
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AnalyticsData>("/api/admin/analytics").then((res) => {
      if (res.success && res.data) setData(res.data);
      else setError(res.error?.message ?? "Gagal memuat analitik.");
    });
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <LoadingState />;

  const hasOrders = data.summary.totalOrders > 0;
  const maxRevenue = Math.max(1, ...data.revenueByDay.map((d) => d.revenue));
  const maxPackage = Math.max(1, ...data.popularPackages.map((p) => p.count));

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Analitik"
        description="Seluruh angka dihitung dari data pesanan nyata. Belum ada data untuk periode ini? Kami menampilkan empty state, bukan angka palsu."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Pesanan" value={data.summary.totalOrders} />
        <StatCard label="Total Revenue" value={formatIDR(data.summary.totalRevenue)} />
        <StatCard label="Total Diskon Kupon" value={formatIDR(data.summary.totalDiscount)} />
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Revenue per Hari (30 hari terakhir)</h2>
        {!hasOrders ? (
          <p className="mt-4 text-sm text-secondary">Belum ada data untuk periode ini.</p>
        ) : data.revenueByDay.length === 0 ? (
          <p className="mt-4 text-sm text-secondary">Belum ada data untuk periode ini.</p>
        ) : (
          <div className="mt-4 flex h-40 items-end gap-1">
            {data.revenueByDay.map((d) => (
              <div key={d.date} className="group relative flex-1">
                <div
                  className="w-full rounded-t bg-accent/80 transition-colors hover:bg-accent"
                  style={{ height: `${Math.max(4, (d.revenue / maxRevenue) * 100)}%` }}
                  title={`${d.date}: ${formatIDR(d.revenue)}`}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Paket Populer</h2>
        {data.popularPackages.length === 0 ? (
          <p className="mt-4 text-sm text-secondary">Belum ada data untuk periode ini.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {data.popularPackages.map((p) => (
              <li key={p.name} className="flex items-center gap-3 text-sm">
                <span className="w-56 truncate">{p.name}</span>
                <div className="h-2 flex-1 rounded-full bg-surface-muted">
                  <div className="h-2 rounded-full bg-accent/70" style={{ width: `${(p.count / maxPackage) * 100}%` }} />
                </div>
                <span className="tabular-nums text-muted">{p.count} pesanan</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Penggunaan Kupon</h2>
          {data.couponUsage.length === 0 ? (
            <p className="mt-4 text-sm text-secondary">Belum ada data untuk periode ini.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {data.couponUsage.map((c) => (
                <li key={c.code} className="flex justify-between">
                  <span className="font-mono">{c.code}</span>
                  <span className="text-muted">{c.count}× · diskon {formatIDR(c.totalDiscount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Status Pesanan</h2>
          {!hasOrders ? (
            <p className="mt-4 text-sm text-secondary">Belum ada data untuk periode ini.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {Object.entries(data.orderStatusCounts).map(([status, count]) => (
                <li key={status} className="flex justify-between">
                  <span>{STATUS_LABEL[status] ?? status}</span>
                  <span className="tabular-nums text-muted">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
