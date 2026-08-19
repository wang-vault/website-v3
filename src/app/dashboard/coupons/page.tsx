"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { formatIDR, formatDate } from "@/lib/utils/format";
import { LoadingState, EmptyState } from "@/components/ui/state";
import type { Coupon } from "@/lib/types";

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ coupons: Coupon[] }>("/api/coupons").then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setCoupons(res.data.coupons);
      else setError("Gagal memuat kupon.");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kupon</h1>
        <p className="mt-1 text-sm text-secondary">
          Kupon aktif yang sedang berlaku. Terapkan kode kupon saat pemesanan di Server Builder — diskon selalu
          dihitung ulang oleh server.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!coupons && !error && <LoadingState />}
      {coupons && coupons.length === 0 && (
        <EmptyState
          title="Belum ada kupon aktif"
          description="Kupon akan tampil di sini ketika tersedia."
        />
      )}
      {coupons && coupons.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coupons.map((c) => {
            const now = Date.now();
            const valid =
              c.active &&
              (!c.expires_at || new Date(c.expires_at).getTime() >= now) &&
              (!c.starts_at || new Date(c.starts_at).getTime() <= now);
            return (
              <li key={c.id} className={`rounded-2xl border p-5 ${valid ? "border-border bg-surface" : "border-border bg-surface-muted opacity-60"}`}>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-lg font-bold tracking-wider">{c.code}</p>
                  <span className={`text-xs font-medium ${valid ? "text-emerald-600" : "text-muted"}`}>
                    {valid ? "Aktif" : "Tidak berlaku"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-secondary">
                  {c.type === "percentage" ? `Diskon ${c.value}%` : `Diskon ${formatIDR(Number(c.value))}`}
                  {c.min_order > 0 && ` · min. ${formatIDR(Number(c.min_order))}`}
                </p>
                {c.expires_at && (
                  <p className="mt-1 text-xs text-muted">Berlaku hingga {formatDate(c.expires_at)}</p>
                )}
                {c.applicable_tiers && c.applicable_tiers.length > 0 && (
                  <p className="mt-1 text-xs text-muted">
                    Berlaku untuk: {c.applicable_tiers.map((t) => t.toUpperCase()).join(", ")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
