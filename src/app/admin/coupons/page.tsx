"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { formatIDR, formatDateTime } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AdminPageHeader } from "@/components/admin/admin-page";
import type { Coupon } from "@/lib/types";

interface CouponRow extends Coupon {
  usedCount: number;
}

const EMPTY_FORM = {
  code: "",
  type: "percentage",
  value: 10,
  minOrder: 0,
  maxUsage: "",
  usagePerCustomer: "",
  startsAt: "",
  expiresAt: "",
  active: true,
  applicableTiers: [] as string[],
};

export default function AdminCouponsPage() {
  const toast = useToast();
  const [coupons, setCoupons] = useState<CouponRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CouponRow | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toDelete, setToDelete] = useState<CouponRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ coupons: CouponRow[] }>("/api/admin/coupons").then((res) => {
      if (res.success && res.data) setCoupons(res.data.coupons);
      else setError(res.error?.message ?? "Gagal memuat kupon.");
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (c: CouponRow) => {
    setForm({
      code: c.code,
      type: c.type,
      value: c.value,
      minOrder: c.min_order,
      maxUsage: c.max_usage === null || c.max_usage === undefined ? "" : String(c.max_usage),
      usagePerCustomer: c.usage_per_customer === null || c.usage_per_customer === undefined ? "" : String(c.usage_per_customer),
      startsAt: c.starts_at ? c.starts_at.slice(0, 16) : "",
      expiresAt: c.expires_at ? c.expires_at.slice(0, 16) : "",
      active: !!c.active,
      applicableTiers: Array.isArray(c.applicable_tiers) ? c.applicable_tiers : [],
    });
    setEditing(c);
  };

  const toggleTier = (tier: string) => {
    setForm((f) => ({
      ...f,
      applicableTiers: f.applicableTiers.includes(tier) ? f.applicableTiers.filter((t) => t !== tier) : [...f.applicableTiers, tier],
    }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      code: form.code,
      type: form.type,
      value: form.value,
      minOrder: form.minOrder,
      maxUsage: form.maxUsage === "" ? null : Number(form.maxUsage),
      usagePerCustomer: form.usagePerCustomer === "" ? null : Number(form.usagePerCustomer),
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      active: form.active,
      applicableTiers: form.applicableTiers.length ? form.applicableTiers : null,
    };
    const res =
      editing === "new"
        ? await apiFetch("/api/admin/coupons", { method: "POST", body: JSON.stringify(payload) })
        : await apiFetch(`/api/admin/coupons/${(editing as CouponRow).id}`, { method: "PATCH", body: JSON.stringify(payload) });
    setSaving(false);
    if (res.success) {
      toast.push("success", editing === "new" ? "Kupon dibuat." : "Kupon diperbarui.");
      setEditing(null);
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  const remove = async () => {
    if (!toDelete) return;
    const res = await apiFetch(`/api/admin/coupons/${toDelete.id}`, { method: "DELETE" });
    if (res.success) {
      toast.push("success", "Kupon dihapus.");
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Kupon & Promosi"
        description="Diskon divalidasi server-side; client tidak pernah menentukan nilai diskon."
        action={<Button size="sm" onClick={() => { setForm(EMPTY_FORM); setEditing("new"); }}>Buat Kupon</Button>}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!coupons && !error && <LoadingState />}
      {coupons && coupons.length === 0 && <EmptyState title="Belum ada kupon" description="Buat kupon pertama melalui tombol di atas." />}
      {coupons && coupons.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coupons.map((c) => (
            <li key={c.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <p className="font-mono text-lg font-bold tracking-wider">{c.code}</p>
                <Badge tone={c.active ? "success" : "neutral"}>{c.active ? "Aktif" : "Nonaktif"}</Badge>
              </div>
              <p className="mt-2 text-sm text-secondary">
                {c.type === "percentage" ? `Diskon ${c.value}%` : `Diskon ${formatIDR(Number(c.value))}`}
                {c.min_order > 0 && ` · min. ${formatIDR(Number(c.min_order))}`}
              </p>
              <p className="mt-1 text-xs text-muted">
                Dipakai {c.usedCount}×{c.max_usage !== null ? ` dari ${c.max_usage}` : ""}
                {c.expires_at ? ` · s.d. ${formatDateTime(c.expires_at)}` : ""}
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setToDelete(c)}>Hapus</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing === "new" ? "Buat Kupon" : `Edit: ${form.code}`}>
          <form onSubmit={save} className="space-y-4">
            <Input label="Kode" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Tipe" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "percentage" | "fixed" })}>
                <option value="percentage">Persentase</option>
                <option value="fixed">Nominal tetap</option>
              </Select>
              <Input label={form.type === "percentage" ? "Nilai (%)" : "Nilai (IDR)"} type="number" min={1} required value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
              <Input label="Minimum pesanan (IDR)" type="number" min={0} value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: Number(e.target.value) })} />
              <Input label="Batas pemakaian total" type="number" min={1} value={form.maxUsage} onChange={(e) => setForm({ ...form, maxUsage: e.target.value })} placeholder="Kosongkan = tanpa batas" />
              <Input label="Batas per pelanggan" type="number" min={1} value={form.usagePerCustomer} onChange={(e) => setForm({ ...form, usagePerCustomer: e.target.value })} placeholder="Kosongkan = tanpa batas" />
              <Input label="Mulai berlaku" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
              <Input label="Kedaluwarsa" type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Berlaku untuk tier</p>
              <div className="flex flex-wrap gap-3">
                {["low", "medium", "high", "vps"].map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.applicableTiers.includes(t)} onChange={() => toggleTier(t)} className="h-4 w-4 accent-accent" />
                    {t.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-accent" />
              Kupon aktif
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Batal</Button>
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        title="Hapus kupon?"
        message={`Kupon "${toDelete?.code}" akan dihapus permanen.`}
      />
    </div>
  );
}
