"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { formatIDR, formatDateTime } from "@/lib/utils/format";
import { ServiceStatusBadge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/ui/state";
import { Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SERVICE_STATUS_LABEL } from "@/components/admin/admin-page";
import type { ServiceInstance, ServiceReminder, ServiceRenewal } from "@/lib/types";

const REMINDER_LABEL: Record<string, string> = {
  expiry_7d: "7 hari sebelum",
  expiry_3d: "3 hari sebelum",
  expiry_1d: "1 hari sebelum",
  expired: "Saat kedaluwarsa",
};

export default function AdminServiceDetailPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [data, setData] = useState<{
    service: ServiceInstance;
    renewals: ServiceRenewal[];
    reminders: ServiceReminder[];
    customer: { id: string; email: string } | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [activationAt, setActivationAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [renewable, setRenewable] = useState(true);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState("");

  const load = useCallback(() => {
    apiFetch<{
      service: ServiceInstance;
      renewals: ServiceRenewal[];
      reminders: ServiceReminder[];
      customer: { id: string; email: string } | null;
    }>(`/api/admin/services/${params.id}`).then((res) => {
      if (res.success && res.data) {
        setData(res.data);
        setStatus(res.data.service.status);
        setRenewable(res.data.service.renewable);
      } else setError(res.error?.message ?? "Layanan tidak ditemukan.");
    });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    const body: Record<string, unknown> = { status, reason };
    if (activationAt) body.activationAt = activationAt;
    if (expiresAt) body.expiresAt = expiresAt;
    body.renewable = renewable;
    const res = await apiFetch(`/api/admin/services/${params.id}`, { method: "PATCH", body: JSON.stringify(body) });
    setSaving(false);
    if (res.success) {
      toast.push("success", "Layanan diperbarui (tercatat di audit log).");
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  const extend = async () => {
    if (!expiresAt) {
      toast.push("error", "Isi waktu kedaluwarsa baru terlebih dahulu.");
      return;
    }
    const res = await apiFetch(`/api/admin/services/${params.id}`, {
      method: "POST",
      body: JSON.stringify({ action: "extend", newExpiresAt: expiresAt, reason: reason || "Perpanjangan manual" }),
    });
    if (res.success) {
      toast.push("success", "Masa layanan diperpanjang (tercatat di audit log).");
      setExpiresAt("");
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  const notify = async () => {
    if (!notifyMsg.trim()) return;
    const res = await apiFetch(`/api/admin/services/${params.id}`, {
      method: "POST",
      body: JSON.stringify({ action: "notify", reason: notifyMsg }),
    });
    if (res.success) {
      toast.push("success", "Notifikasi dikirim ke dashboard pelanggan.");
      setNotifyMsg("");
    } else toast.push("error", apiErrorMessage(res));
  };

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;
  const { service, renewals, reminders, customer } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/services" className="text-sm text-muted hover:text-primary">← Semua Layanan</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{service.name}</h1>
          <ServiceStatusBadge status={service.status} />
        </div>
        <p className="mt-1 text-sm text-muted">
          {service.service_number} · pelanggan: {customer ? customer.email : "tanpa akun"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Detail</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Tipe</dt><dd>{service.service_type === "vps" ? "VPS" : "Server Builder"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Harga</dt><dd className="tabular-nums">{formatIDR(Number(service.price))}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Aktivasi</dt><dd className="tabular-nums">{formatDateTime(service.activation_at)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Berakhir</dt><dd className="tabular-nums">{formatDateTime(service.expires_at)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Dapat diperpanjang</dt><dd>{service.renewable ? "Ya" : "Tidak"}</dd></div>
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Kelola Siklus Hidup</h2>
          <div className="mt-3 space-y-3">
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(SERVICE_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
            <Input label="Waktu aktivasi" type="datetime-local" value={activationAt} onChange={(e) => setActivationAt(e.target.value)} />
            <Input label="Waktu kedaluwarsa" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={renewable} onChange={(e) => setRenewable(e.target.checked)} className="h-4 w-4 accent-accent" />
              Dapat diperpanjang
            </label>
            <Input label="Alasan (wajib untuk audit)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Simpan Perubahan"}</Button>
              <Button variant="secondary" onClick={extend}>Perpanjang Manual</Button>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Kirim Notifikasi</h2>
        <div className="mt-3 flex gap-2">
          <Input label="Pesan ke pelanggan" value={notifyMsg} onChange={(e) => setNotifyMsg(e.target.value)} placeholder="Contoh: pembaruan terkait layanan Anda…" />
          <div className="flex items-end">
            <Button variant="secondary" onClick={notify} disabled={!notifyMsg.trim()}>Kirim</Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Riwayat Perpanjangan ({renewals.length})</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {renewals.length === 0 && <li className="text-muted">Belum ada perpanjangan.</li>}
          {renewals.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-border px-4 py-2.5">
              <span>{r.duration_days} hari · {formatIDR(Number(r.price))}</span>
              <span className="text-xs text-muted">{r.old_expires_at ? new Date(r.old_expires_at).toLocaleDateString("id-ID") : "—"} → {new Date(r.new_expires_at).toLocaleDateString("id-ID")}</span>
              <span className={`text-xs font-medium ${r.status === "completed" ? "text-emerald-600" : r.status === "pending" ? "text-amber-600" : "text-muted"}`}>{r.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Reminder ({reminders.length})</h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          {reminders.length === 0 && <li className="text-muted">Belum ada reminder terjadwal.</li>}
          {reminders.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2">
              <span>{REMINDER_LABEL[r.reminder_type] ?? r.reminder_type}</span>
              <span className="text-xs text-muted">
                jadwal {formatDateTime(r.scheduled_at)} · {r.status} {r.sent_at ? `· terkirim ${formatDateTime(r.sent_at)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
