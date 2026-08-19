"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { formatIDR, formatDateTime } from "@/lib/utils/format";
import { OrderStatusBadge, ServiceStatusBadge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/ui/state";
import { Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { ORDER_STATUS_LABEL } from "@/components/admin/admin-page";
import type { Order, OrderItem, ServiceInstance } from "@/lib/types";

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [data, setData] = useState<{ order: Order; items: OrderItem[]; services: ServiceInstance[]; renewals: { id: string; duration_days: number; status: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [activationAt, setActivationAt] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [renewable, setRenewable] = useState(true);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ order: Order; items: OrderItem[]; services: ServiceInstance[]; renewals: { id: string; duration_days: number; status: string }[] }>(
      `/api/admin/orders/${params.id}`,
    ).then((res) => {
      if (res.success && res.data) {
        setData(res.data);
        setStatus(res.data.order.status);
      } else setError(res.error?.message ?? "Pesanan tidak ditemukan.");
    });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async () => {
    setSaving(true);
    const body: Record<string, unknown> = { status, reason };
    if (status === "paid") {
      if (activationAt) body.activationAt = activationAt;
      body.durationDays = durationDays;
      body.renewable = renewable;
    }
    const res = await apiFetch(`/api/admin/orders/${params.id}`, { method: "PATCH", body: JSON.stringify(body) });
    setSaving(false);
    if (res.success) {
      toast.push("success", "Status pesanan diperbarui.");
      load();
    } else {
      toast.push("error", apiErrorMessage(res));
    }
  };

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;
  const { order } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/orders" className="text-sm text-muted hover:text-primary">← Semua Pesanan</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{order.order_number}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-sm text-muted">Dibuat {formatDateTime(order.created_at)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Pelanggan & Layanan</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Nama</dt><dd>{order.customer_name}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">WhatsApp</dt><dd>{order.customer_whatsapp}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Email</dt><dd className="break-all text-right">{order.customer_email}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Tier</dt><dd>{order.tier_name}</dd></div>
            {order.package_name && <div className="flex justify-between"><dt className="text-muted">Paket</dt><dd>{order.package_name}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted">Spesifikasi</dt><dd>{order.cpu} vCore · {order.ram} GB · {order.storage} GB</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Nama Server</dt><dd>{order.server_name}</dd></div>
            {order.notes && <div className="flex justify-between gap-3"><dt className="text-muted">Catatan</dt><dd className="text-right">{order.notes}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted">Sumber</dt><dd>{order.source === "renewal" ? "Perpanjangan" : "Web"}</dd></div>
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Harga</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Harga</dt><dd className="tabular-nums">{formatIDR(order.price_raw)}</dd></div>
            {order.coupon_code && <div className="flex justify-between"><dt className="text-muted">Kupon {order.coupon_code}</dt><dd className="tabular-nums text-emerald-600">-{formatIDR(order.discount)}</dd></div>}
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatIDR(order.total)}</dd></div>
          </dl>

          <div className="mt-5 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Ubah Status</h3>
            <div className="mt-3 space-y-3">
              <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
              {status === "paid" && (
                <>
                  <Input label="Waktu aktivasi layanan" type="datetime-local" value={activationAt} onChange={(e) => setActivationAt(e.target.value)} hint="Kosongkan = aktivasi sekarang (waktu server)." />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Durasi (hari)" type="number" min={1} max={365} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} />
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={renewable} onChange={(e) => setRenewable(e.target.checked)} className="h-4 w-4 accent-accent" />
                        Dapat diperpanjang
                      </label>
                    </div>
                  </div>
                </>
              )}
              <Input label="Alasan (untuk audit)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Opsional" />
              <Button onClick={updateStatus} disabled={saving || status === order.status}>
                {saving ? "Menyimpan…" : "Simpan Status"}
              </Button>
            </div>
          </div>
        </section>
      </div>

      {data.services.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Layanan Terkait</h2>
          <ul className="mt-3 space-y-2">
            {data.services.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/admin/services/${s.id}`} className="text-sm font-medium hover:underline">
                  {s.name} ({s.service_number})
                </Link>
                <ServiceStatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.renewals.length > 0 && (
        <Alert tone="info" title="Perpanjangan terkait">
          {data.renewals.length} renewal order tercatat untuk pesanan ini.
        </Alert>
      )}
    </div>
  );
}
