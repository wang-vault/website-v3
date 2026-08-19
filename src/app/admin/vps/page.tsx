"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { formatIDR } from "@/lib/utils/format";
import { PackageStatusBadge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AdminPageHeader, PACKAGE_STATUS_LABEL } from "@/components/admin/admin-page";
import type { VpsLocation, VpsPackage } from "@/lib/types";

const EMPTY_FORM = {
  name: "",
  cpu: 2,
  ram: 4,
  storage: 40,
  bandwidth: "",
  ipv4Available: true,
  locationId: "",
  virtualization: "KVM",
  price: 100000,
  billingPeriod: "monthly",
  renewable: true,
  description: "",
  features: "",
  status: "available",
  visible: true,
  stock: "",
};

export default function AdminVpsPage() {
  const toast = useToast();
  const [packages, setPackages] = useState<VpsPackage[] | null>(null);
  const [locations, setLocations] = useState<VpsLocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<VpsPackage | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toDelete, setToDelete] = useState<VpsPackage | null>(null);
  const [saving, setSaving] = useState(false);
  const [locForm, setLocForm] = useState({ name: "", country: "", city: "" });

  const load = useCallback(() => {
    Promise.all([
      apiFetch<{ packages: VpsPackage[] }>("/api/admin/vps-packages"),
      apiFetch<{ locations: VpsLocation[] }>("/api/admin/locations"),
    ]).then(([p, l]) => {
      if (p.success && p.data) setPackages(p.data.packages);
      else setError(p.error?.message ?? "Gagal memuat paket.");
      if (l.success && l.data) setLocations(l.data.locations);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditing("new");
  };

  const openEdit = (p: VpsPackage) => {
    setForm({
      name: p.name,
      cpu: p.cpu,
      ram: p.ram,
      storage: p.storage,
      bandwidth: p.bandwidth ?? "",
      ipv4Available: !!p.ipv4_available,
      locationId: p.location_id ?? "",
      virtualization: p.virtualization ?? "KVM",
      price: p.price,
      billingPeriod: p.billing_period ?? "monthly",
      renewable: !!p.renewable,
      description: p.description ?? "",
      features: Array.isArray(p.features) ? p.features.join("\n") : "",
      status: p.status,
      visible: !!p.visible,
      stock: p.stock === null || p.stock === undefined ? "" : String(p.stock),
    });
    setEditing(p);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      locationId: form.locationId || null,
      features: form.features.split("\n").map((f) => f.trim()).filter(Boolean),
      stock: form.stock === "" ? null : Number(form.stock),
    };
    const res =
      editing === "new"
        ? await apiFetch("/api/admin/vps-packages", { method: "POST", body: JSON.stringify(payload) })
        : await apiFetch(`/api/admin/vps-packages/${(editing as VpsPackage).id}`, { method: "PATCH", body: JSON.stringify(payload) });
    setSaving(false);
    if (res.success) {
      toast.push("success", editing === "new" ? "Paket VPS dibuat." : "Paket VPS diperbarui.");
      setEditing(null);
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  const remove = async () => {
    if (!toDelete) return;
    const res = await apiFetch(`/api/admin/vps-packages/${toDelete.id}`, { method: "DELETE" });
    if (res.success) {
      toast.push("success", "Paket VPS diarsipkan.");
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  const addLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch("/api/admin/locations", { method: "POST", body: JSON.stringify(locForm) });
    if (res.success) {
      toast.push("success", "Lokasi ditambahkan.");
      setLocForm({ name: "", country: "", city: "" });
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="VPS Packages"
        description="Katalog paket VPS (database-driven). Perubahan tercatat di audit log."
        action={<Button size="sm" onClick={openNew}>Buat Paket VPS</Button>}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!packages && !error && <LoadingState />}
      {packages && packages.length === 0 && <EmptyState title="Belum ada paket VPS" description="Buat paket VPS pertama melalui tombol di atas." />}
      {packages && packages.length > 0 && (
        <ul className="grid gap-4 lg:grid-cols-2">
          {packages.map((p) => (
            <li key={p.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted">{p.slug}</p>
                </div>
                <PackageStatusBadge status={p.status} />
              </div>
              <p className="mt-2 text-sm text-secondary">
                {p.cpu} vCore · {p.ram} GB · {p.storage} GB · {p.bandwidth || "—"}
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {formatIDR(p.price)}<span className="text-xs font-normal text-muted">/{p.billing_period}</span>
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setToDelete(p)}>Arsipkan</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Lokasi Server</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {locations.length === 0 && <p className="text-sm text-muted">Belum ada lokasi.</p>}
          {locations.map((l) => (
            <span key={l.id} className="rounded-full border border-border px-3 py-1 text-xs">
              {l.name} · {l.city} {l.country} {l.status === "inactive" ? "(nonaktif)" : ""}
            </span>
          ))}
        </div>
        <form onSubmit={addLocation} className="mt-4 grid gap-3 sm:grid-cols-4">
          <Input label="Nama" required value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} placeholder="DC Jakarta" />
          <Input label="Kota" value={locForm.city} onChange={(e) => setLocForm({ ...locForm, city: e.target.value })} placeholder="Jakarta" />
          <Input label="Negara" value={locForm.country} onChange={(e) => setLocForm({ ...locForm, country: e.target.value })} placeholder="Indonesia" />
          <div className="flex items-end">
            <Button type="submit" variant="secondary">Tambah</Button>
          </div>
        </form>
      </section>

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing === "new" ? "Buat Paket VPS" : `Edit: ${editing.name}`} wide>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Nama Paket" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as VpsPackage["status"] })}>
                {Object.entries(PACKAGE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
              <Input label="CPU (vCore)" type="number" min={1} required value={form.cpu} onChange={(e) => setForm({ ...form, cpu: Number(e.target.value) })} />
              <Input label="RAM (GB)" type="number" min={1} required value={form.ram} onChange={(e) => setForm({ ...form, ram: Number(e.target.value) })} />
              <Input label="Penyimpanan (GB)" type="number" min={1} required value={form.storage} onChange={(e) => setForm({ ...form, storage: Number(e.target.value) })} />
              <Input label="Bandwidth" value={form.bandwidth} onChange={(e) => setForm({ ...form, bandwidth: e.target.value })} placeholder="2 TB/bulan" />
              <Input label="Harga (IDR/bulan)" type="number" min={0} required value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
              <Select label="Lokasi" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                <option value="">Tanpa lokasi</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
              <Input label="Virtualisasi" value={form.virtualization} onChange={(e) => setForm({ ...form, virtualization: e.target.value })} placeholder="KVM" />
              <Input label="Periode tagihan" value={form.billingPeriod} onChange={(e) => setForm({ ...form, billingPeriod: e.target.value })} placeholder="monthly" />
              <Input label="Stok (kosongkan = tidak dibatasi)" type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </div>
            <Textarea label="Deskripsi" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Textarea label="Fitur (satu per baris)" rows={3} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} />
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.ipv4Available} onChange={(e) => setForm({ ...form, ipv4Available: e.target.checked })} className="h-4 w-4 accent-accent" /> IPv4 tersedia
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.renewable} onChange={(e) => setForm({ ...form, renewable: e.target.checked })} className="h-4 w-4 accent-accent" /> Dapat diperpanjang
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} className="h-4 w-4 accent-accent" /> Tampil di katalog
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
        title="Arsipkan paket VPS?"
        message={`Paket "${toDelete?.name}" akan diarsipkan dan tidak dapat dipesan.`}
      />
    </div>
  );
}
