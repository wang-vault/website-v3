"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/client/api";
import { formatIDR, formatDateTime } from "@/lib/utils/format";
import { OrderStatusBadge, ServiceStatusBadge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/ui/state";
import type { Order, Profile, ServiceInstance } from "@/lib/types";

export default function AdminCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<{ customer: { email: string; status: string; emailVerified: boolean; roleSlug: string; createdAt: string }; profile: Profile | null; orders: Order[]; services: ServiceInstance[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<typeof data>(`/api/admin/customers/${params.id}`).then((res) => {
      if (res.success && res.data) setData(res.data);
      else setError(res.error?.message ?? "Pelanggan tidak ditemukan.");
    });
  }, [params.id]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;
  const { customer, profile, orders, services } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/customers" className="text-sm text-muted hover:text-primary">← Semua Pelanggan</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{profile?.full_name || customer.email}</h1>
        <p className="mt-1 text-sm text-muted">
          {customer.email} · role {customer.roleSlug} · {customer.status} · bergabung {formatDateTime(customer.createdAt)}
        </p>
      </div>

      {profile && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Profil</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Nama</dt><dd>{profile.full_name || "—"}</dd></div>
            <div><dt className="text-muted">WhatsApp</dt><dd>{profile.whatsapp || "—"}</dd></div>
            <div><dt className="text-muted">Discord</dt><dd>{profile.discord || "—"}</dd></div>
            <div><dt className="text-muted">Bio</dt><dd>{profile.bio || "—"}</dd></div>
          </dl>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Pesanan ({orders.length})</h2>
        <ul className="mt-3 divide-y divide-border">
          {orders.length === 0 && <li className="py-3 text-sm text-muted">Belum ada pesanan.</li>}
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <Link href={`/admin/orders/${o.id}`} className="text-sm font-medium hover:underline">
                {o.order_number}
              </Link>
              <span className="text-xs text-muted">{formatIDR(o.total)} · {formatDateTime(o.created_at)}</span>
              <OrderStatusBadge status={o.status} />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Layanan ({services.length})</h2>
        <ul className="mt-3 divide-y divide-border">
          {services.length === 0 && <li className="py-3 text-sm text-muted">Belum ada layanan.</li>}
          {services.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <Link href={`/admin/services/${s.id}`} className="text-sm font-medium hover:underline">
                {s.name} ({s.service_number})
              </Link>
              <span className="text-xs text-muted">berakhir {formatDateTime(s.expires_at)}</span>
              <ServiceStatusBadge status={s.status} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
