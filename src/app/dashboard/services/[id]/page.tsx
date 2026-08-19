"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { formatIDR, formatDateTime, remainingDuration } from "@/lib/utils/format";
import { ServiceStatusBadge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/state";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ServiceInstance, ServiceRenewal, ServiceReminder } from "@/lib/types";

const REMINDER_LABEL: Record<string, string> = {
  expiry_7d: "7 hari sebelum kedaluwarsa",
  expiry_3d: "3 hari sebelum kedaluwarsa",
  expiry_1d: "1 hari sebelum kedaluwarsa",
  expired: "Saat kedaluwarsa",
};

export default function ServiceDetailPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [data, setData] = useState<{ service: ServiceInstance; renewals: ServiceRenewal[]; reminders: ServiceReminder[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [duration, setDuration] = useState(30);
  const [renewing, setRenewing] = useState(false);

  const load = () => {
    apiFetch<{ service: ServiceInstance; renewals: ServiceRenewal[] }>(`/api/services/${params.id}`).then((res) => {
      if (res.success && res.data) {
        apiFetch<{ reminders: ServiceReminder[] }>(`/api/services/${params.id}/reminders`).then((r2) => {
          if (r2.success) setData({ ...res.data!, reminders: r2.data?.reminders ?? [] });
          else setData({ ...res.data!, reminders: [] });
        });
      } else {
        setError(res.error?.message ?? "Layanan tidak ditemukan.");
      }
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const renew = async () => {
    setRenewing(true);
    const res = await apiFetch<{ order: { orderNumber: string; total: number }; whatsappUrl: string | null }>(`/api/services/${params.id}/renew`, {
      method: "POST",
      body: JSON.stringify({ durationDays: duration }),
    });
    setRenewing(false);
    if (res.success && res.data) {
      setRenewOpen(false);
      toast.push("success", `Pesanan perpanjangan ${res.data.order.orderNumber} dibuat.`);
      if (res.data.whatsappUrl) {
        window.open(res.data.whatsappUrl, "_blank", "noopener");
      }
      load();
    } else {
      toast.push("error", apiErrorMessage(res));
    }
  };

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;
  const { service, renewals, reminders } = data;
  const expired = new Date(service.expires_at).getTime() <= Date.now();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/services" className="text-sm text-muted hover:text-primary">← Semua Layanan</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{service.name}</h1>
          <ServiceStatusBadge status={service.status} />
        </div>
        <p className="mt-1 text-sm text-muted">{service.service_number}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Masa Layanan</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Status</dt><dd>{service.status}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Aktivasi</dt><dd className="tabular-nums">{formatDateTime(service.activation_at)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Berakhir</dt><dd className="tabular-nums">{formatDateTime(service.expires_at)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Sisa masa</dt><dd className="font-medium">{remainingDuration(service.expires_at)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Dapat diperpanjang</dt><dd>{service.renewable ? "Ya" : "Tidak"}</dd></div>
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Informasi</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Tipe layanan</dt><dd>{service.service_type === "vps" ? "VPS" : "Server Builder"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Harga</dt><dd className="tabular-nums">{formatIDR(Number(service.price))}/bln</dd></div>
            <div className="flex justify-between"><dt className="text-muted">ID Pesanan</dt><dd>{service.order_id.slice(0, 8)}…</dd></div>
          </dl>
          <div className="mt-4 border-t border-border pt-4">
            {service.renewable ? (
              <Button onClick={() => setRenewOpen(true)} disabled={["cancelled", "terminated"].includes(service.status)}>
                Perpanjang Layanan
              </Button>
            ) : (
              <p className="text-xs text-muted">Layanan ini tidak dapat diperpanjang.</p>
            )}
            {expired && (
              <p className="mt-2 text-xs text-amber-600">
                Layanan telah kedaluwarsa. Bila dapat diperpanjang, masa baru dihitung mulai dari waktu perpanjangan disetujui.
              </p>
            )}
          </div>
        </section>
      </div>

      {renewals.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Riwayat Perpanjangan</h2>
          <ul className="mt-3 space-y-2">
            {renewals.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 text-sm">
                <span className="text-muted">
                  {r.duration_days} hari · {formatIDR(Number(r.price))}
                </span>
                <span className="text-xs text-muted">
                  {r.old_expires_at ? `${new Date(r.old_expires_at).toLocaleDateString("id-ID")} → ${new Date(r.new_expires_at).toLocaleDateString("id-ID")}` : ""}
                </span>
                <span className={`text-xs font-medium ${r.status === "completed" ? "text-emerald-600" : r.status === "pending" ? "text-amber-600" : "text-muted"}`}>
                  {r.status === "completed" ? "Selesai" : r.status === "pending" ? "Menunggu pembayaran" : "Dibatalkan"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reminders.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Pengingat</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {reminders.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-secondary">{REMINDER_LABEL[r.reminder_type] ?? r.reminder_type}</span>
                <span className="text-xs text-muted">
                  {r.status === "sent" ? `Dikirim ${r.sent_at ? formatDateTime(r.sent_at) : ""}` : r.status === "scheduled" ? "Terjadwal" : r.status}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Pengingat dikirim melalui notifikasi dashboard. Email hanya jika SMTP dikonfigurasi; WhatsApp belum tersedia.
          </p>
        </section>
      )}

      {renewals.length === 0 && (
        <div>
          <EmptyState title="Belum ada perpanjangan" description="Riwayat perpanjangan layanan akan tampil di sini." />
        </div>
      )}

      {renewOpen && (
        <Modal open onClose={() => setRenewOpen(false)} title="Perpanjang Layanan">
          <div className="space-y-4">
            <Alert tone="info">
              Layanan aktif: masa baru dihitung dari tanggal kedaluwarsa saat ini. Layanan kedaluwarsa: masa baru
              dihitung dari waktu server saat perpanjangan disetujui. Harga memakai harga paket yang berlaku.
            </Alert>
            <Input
              label="Durasi perpanjangan (hari)"
              type="number"
              min={1}
              max={365}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRenewOpen(false)}>Batal</Button>
              <Button onClick={renew} disabled={renewing || duration < 1 || duration > 365}>
                {renewing ? "Membuat pesanan…" : "Buat Pesanan Perpanjangan"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
