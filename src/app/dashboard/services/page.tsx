"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/api";
import { formatIDR, remainingDuration } from "@/lib/utils/format";
import { ServiceStatusBadge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/state";
import type { ServiceInstance } from "@/lib/types";

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceInstance[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ services: ServiceInstance[] }>("/api/services").then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setServices(res.data.services);
      else setError("Gagal memuat layanan.");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Layanan Saya</h1>
        <p className="mt-1 text-sm text-secondary">
          Status layanan dihitung dari waktu server. Waktu aktivasi dan kedaluwarsa tidak dapat diubah dari sisi pelanggan.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!services && !error && <LoadingState />}
      {services && services.length === 0 && (
        <EmptyState
          title="Belum ada layanan"
          description="Layanan dibuat setelah pesanan Anda dikonfirmasi pembayarannya."
          action={
            <Link href="/server-builder" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:opacity-90">
              Buat Server
            </Link>
          }
        />
      )}
      {services && services.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {services.map((s) => (
            <li key={s.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/dashboard/services/${s.id}`} className="font-semibold hover:underline">
                    {s.name}
                  </Link>
                  <p className="text-xs text-muted">{s.service_number}</p>
                </div>
                <ServiceStatusBadge status={s.status} />
              </div>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Aktivasi</dt><dd className="tabular-nums">{new Date(s.activation_at).toLocaleDateString("id-ID")}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Berakhir</dt><dd className="tabular-nums">{new Date(s.expires_at).toLocaleDateString("id-ID")}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Sisa masa</dt><dd className="font-medium">{remainingDuration(s.expires_at)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Harga</dt><dd className="tabular-nums">{formatIDR(Number(s.price))}/bln</dd></div>
              </dl>
              <div className="mt-4 border-t border-border pt-3">
                {s.renewable ? (
                  <Link
                    href={`/dashboard/services/${s.id}`}
                    className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:opacity-90"
                  >
                    Perpanjang Layanan
                  </Link>
                ) : (
                  <p className="text-xs text-muted">Layanan ini tidak dapat diperpanjang.</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
