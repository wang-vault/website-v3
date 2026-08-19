"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/api";
import { formatIDR } from "@/lib/utils/format";
import { StatCard } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/state";
import { AdminPageHeader } from "@/components/admin/admin-page";

interface OverviewData {
  stats: {
    totalOrders: number;
    todayOrders: number;
    monthOrders: number;
    pendingOrders: number;
    totalCustomers: number;
    activeServices: number;
    expiringSoon: number;
    revenue: number;
    monthRevenue: number;
    todayRevenue: number;
  };
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<OverviewData>("/api/admin/overview").then((res) => {
      if (res.success && res.data) setData(res.data);
      else setError(res.error?.message ?? "Gagal memuat ringkasan.");
    });
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <LoadingState label="Memuat ringkasan admin…" />;

  const s = data.stats;
  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Ringkasan"
        description="Angka dihitung langsung dari database — tidak ada data palsu."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Pesanan" value={s.totalOrders} hint={`${s.todayOrders} hari ini · ${s.monthOrders} bulan ini`} />
        <StatCard label="Revenue" value={formatIDR(s.revenue)} hint={`${formatIDR(s.todayRevenue)} hari ini`} />
        <StatCard label="Pelanggan Aktif" value={s.totalCustomers} />
        <StatCard label="Layanan Aktif" value={s.activeServices} hint={`${s.expiringSoon} kedaluwarsa ≤ 7 hari`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Menunggu Konfirmasi" value={s.pendingOrders} hint="Pesanan pending / menunggu pembayaran" />
        <StatCard label="Revenue Bulan Ini" value={formatIDR(s.monthRevenue)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { href: "/admin/orders", label: "Kelola Pesanan" },
          { href: "/admin/packages", label: "Kelola Paket Medium/High" },
          { href: "/admin/vps", label: "Kelola VPS Packages" },
          { href: "/admin/pricing", label: "Kelola Formula Harga" },
          { href: "/admin/coupons", label: "Kelola Kupon" },
          { href: "/admin/cms", label: "Kelola Konten" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-2xl border border-border bg-surface p-5 text-sm font-medium transition-colors hover:bg-surface-muted"
          >
            {l.label} →
          </Link>
        ))}
      </div>
    </div>
  );
}
