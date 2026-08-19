"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { formatIDR } from "@/lib/utils/format";
import { PackageStatusBadge, Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { AdminPageHeader, PACKAGE_STATUS_LABEL } from "@/components/admin/admin-page";
import type { ServerPackage } from "@/lib/types";

interface PackageRow extends ServerPackage {
  tierSlug: string;
}

const EMPTY_FORM = {
  tierSlug: "medium",
  name: "",
  cpu: 4,
  ram: 8,
  storage: 80,
  price: 75000,
  description: "",
  status: "available",
  visible: true,
  orderable: true,
  popular: false,
  popularLabel: "",
  performanceFactor: 1,
};

export default function AdminServerPackagesPage() {
  const toast = useToast();
  const [packages, setPackages] = useState<PackageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PackageRow | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toDelete, setToDelete] = useState<PackageRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ packages: PackageRow[] }>("/api/admin/packages").then((res) => {
      if (res.success && res.data) setPackages(res.data.packages);
      else setError(res.error?.message ?? "Gagal memuat paket.");
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (p: PackageRow) => {
    setForm({
      tierSlug: p.tierSlug,
      name: p.name,
      cpu: p.cpu,
      ram: p.ram,
      storage: p.storage,
      price: p.price,
      description: p.description ?? "",
      status: p.status,
      visible: !!p.visible,
      orderable: !!p.orderable,
      popular: !!p.popular,
      popularLabel: p.popular_label ?? "",
      performanceFactor: Number(p.performance_factor) || 1,
    });
    setEditing(p);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res =
      editing === "new"
        ? await apiFetch("/api/admin/packages", { method: "POST", body: JSON.stringify(form) })
        : await apiFetch(`/api/admin/packages/${(editing as PackageRow).id}`, { method: "PATCH", body: JSON.stringify(form) });
    setSaving(false);
    if (res.success) {
      toast.push("success", editing === "new" ? "Paket dibuat." : "Paket diperbarui.");
      setEditing(null);
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  const remove = async () => {
    if (!toDelete) return;
    const res = await apiFetch(`/api/admin/packages/${toDelete.id}`, { method: "DELETE" });
    if (res.success) {
      toast.push("success", "Paket diarsipkan (tidak dapat dipesan).");
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Paket Medium & High"
        description="Paket Server Builder Tier Medium/High — KHUSUS OWNER. Paket hanya muncul di Server Builder setelah dibuat di sini."
        action={<Button size="sm" onClick={() => { setForm({ ...EMPTY_FORM, tierSlug: "medium" }); setEditing("new"); }}>Buat Paket</Button>}
      />
      <Alert tone="info">
        Tidak ada paket default yang di-hardcode. Tanpa paket di database, Server Builder menampilkan empty state yang jujur.
      </Alert>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!packages && !error && <LoadingState />}
      {packages && packages.length === 0 && (
        <EmptyState title="Belum ada paket Medium/High" description="Buat paket pertama melalui tombol di atas." />
      )}
      {packages && packages.length > 0 && (
        <ul className="grid gap-4 lg:grid-cols-2">
          {packages.map((p) => (
            <li key={p.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted">
                    Tier {p.tierSlug === "medium" ? "Medium" : "High"} · {p.slug}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {p.popular && <Badge tone="accent">{p.popular_label || "Populer"}</Badge>}
                  <PackageStatusBadge status={p.status} />
                </div>
              </div>
              <p className="mt-2 text-sm text-secondary">
                {p.cpu} vCore · {p.ram} GB · {p.storage} GB
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {formatIDR(p.price)}<span className="text-xs font-normal text-muted">/bln</span>
                {!p.orderable && <span className="ml-2 text-xs font-normal text-amber-600">tidak dapat dipesan</span>}
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setToDelete(p)}>Arsipkan</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing === "new" ? "Buat Paket" : `Edit: ${editing.name}`}>
          <form onSubmit={save} className="space-y-4">
            <Select label="Tier" value={form.tierSlug} onChange={(e) => setForm({ ...form, tierSlug: e.target.value as "medium" | "high" })}>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
            <Input label="Nama Paket" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-3 gap-3">
              <Input label="CPU" type="number" min={1} required value={form.cpu} onChange={(e) => setForm({ ...form, cpu: Number(e.target.value) })} />
              <Input label="RAM (GB)" type="number" min={1} required value={form.ram} onChange={(e) => setForm({ ...form, ram: Number(e.target.value) })} />
              <Input label="Storage (GB)" type="number" min={1} required value={form.storage} onChange={(e) => setForm({ ...form, storage: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Harga (IDR/bulan)" type="number" min={0} required value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
              <Input label="Faktor performa" type="number" step={0.05} min={0.5} max={2} value={form.performanceFactor} onChange={(e) => setForm({ ...form, performanceFactor: Number(e.target.value) })} hint="Untuk estimasi (bukan harga)" />
            </div>
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ServerPackage["status"] })}>
              {Object.entries(PACKAGE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Textarea label="Deskripsi" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input label="Label populer (opsional)" value={form.popularLabel} onChange={(e) => setForm({ ...form, popularLabel: e.target.value })} placeholder="Paling Laris" />
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} className="h-4 w-4 accent-accent" /> Tampil di katalog
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.orderable} onChange={(e) => setForm({ ...form, orderable: e.target.checked })} className="h-4 w-4 accent-accent" /> Dapat dipesan
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.popular} onChange={(e) => setForm({ ...form, popular: e.target.checked })} className="h-4 w-4 accent-accent" /> Paket populer
              </label>
            </div>
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
        title="Arsipkan paket?"
        message={`Paket "${toDelete?.name}" akan diarsipkan dan tidak dapat dipesan.`}
      />
    </div>
  );
}
