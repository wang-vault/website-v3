"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { formatIDR } from "@/lib/utils/format";
import { LoadingState } from "@/components/ui/state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { AdminPageHeader, FormCard, FieldGrid } from "@/components/admin/admin-page";

interface RulesDto {
  base: number;
  perCore: number;
  perGbRam: number;
  perGbStorage: number;
  minPrice: number;
  maxPrice: number | null;
  rounding: number;
  cpu: { min: number; max: number; step: number };
  ram: { min: number; max: number; step: number };
  storage: { min: number; max: number; step: number };
  safetyLimits?: { cpu: { min: number; max: number }; ram: { min: number; max: number }; storage: { min: number; max: number } };
  defaultConfig?: { cpu: number; ram: number; storage: number };
  defaultPrice?: { total: number };
  version?: number;
}

export default function AdminPricingPage() {
  const toast = useToast();
  const [data, setData] = useState<RulesDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<RulesDto>("/api/admin/pricing").then((res) => {
      if (res.success && res.data) setData(res.data);
      else setError(res.error?.message ?? "Gagal memuat formula harga.");
    });
  }, []);

  const set = (path: string, value: number | null) => {
    if (!data) return;
    setData((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const parts = path.split(".");
      let cur: Record<string, unknown> = next as unknown as Record<string, unknown>;
      for (let i = 0; i < parts.length - 1; i++) {
        cur = cur[parts[i]] as Record<string, unknown>;
      }
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    const payload = {
      base: data.base,
      perCore: data.perCore,
      perGbRam: data.perGbRam,
      perGbStorage: data.perGbStorage,
      minPrice: data.minPrice,
      maxPrice: data.maxPrice,
      rounding: data.rounding,
      cpu: data.cpu,
      ram: data.ram,
      storage: data.storage,
    };
    const res = await apiFetch<RulesDto>("/api/admin/pricing", { method: "PATCH", body: JSON.stringify(payload) });
    setSaving(false);
    if (res.success) {
      toast.push("success", "Formula harga diperbarui (tercatat di audit log).");
      if (res.data) setData(res.data);
    } else toast.push("error", apiErrorMessage(res));
  };

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <LoadingState />;

  const rules = data;
  const def = rules.defaultConfig;
  const defPrice = rules.defaultPrice;

  return (
    <div className="max-w-3xl space-y-6">
      <AdminPageHeader
        title="Formula Harga (Tier Low)"
        description="Satu sumber kebenaran harga — dipakai bersama oleh UI Server Builder dan API. Perubahan divalidasi server-side dan dicatat di audit log."
      />
      {def && defPrice && (
        <Alert tone="info" title="Konfigurasi default saat ini">
          {def.cpu} vCore / {def.ram} GB / {def.storage} GB → {formatIDR(defPrice.total)}/bulan
          (harga minimum {formatIDR(rules.minPrice)} diterapkan bila hasil formula di bawahnya).
        </Alert>
      )}
      {data.version !== undefined && (
        <p className="text-xs text-muted">Versi aturan: {data.version}</p>
      )}

      <form onSubmit={save} className="space-y-5">
        <FormCard title="Harga">
          <FieldGrid>
            <Input label="Base (IDR)" type="number" min={0} required value={rules.base} onChange={(e) => set("base", Number(e.target.value))} />
            <Input label="Per Core (IDR)" type="number" min={0} required value={rules.perCore} onChange={(e) => set("perCore", Number(e.target.value))} />
            <Input label="Per GB RAM (IDR)" type="number" min={0} required value={rules.perGbRam} onChange={(e) => set("perGbRam", Number(e.target.value))} />
            <Input label="Per GB Storage (IDR)" type="number" min={0} required value={rules.perGbStorage} onChange={(e) => set("perGbStorage", Number(e.target.value))} />
            <Input label="Harga Minimum (IDR)" type="number" min={0} required value={rules.minPrice} onChange={(e) => set("minPrice", Number(e.target.value))} />
            <Input label="Harga Maksimum (IDR, opsional)" type="number" min={0} value={rules.maxPrice ?? ""} onChange={(e) => set("maxPrice", e.target.value === "" ? null : Number(e.target.value))} />
            <Input label="Pembulatan (kelipatan Rp)" type="number" min={1} required value={rules.rounding} onChange={(e) => set("rounding", Number(e.target.value))} />
          </FieldGrid>
        </FormCard>

        <FormCard title="Batas Konfigurasi (CPU / RAM / Penyimpanan)">
          <p className="text-xs text-muted">
            Batas keamanan absolut server: CPU {rules.safetyLimits?.cpu.max ?? 16}, RAM {rules.safetyLimits?.ram.max ?? 32} GB,
            Storage {rules.safetyLimits?.storage.max ?? 160} GB. Nilai di sini tidak boleh melewatinya.
          </p>
          <FieldGrid>
            <Input label="CPU Min" type="number" min={1} required value={rules.cpu.min} onChange={(e) => set("cpu.min", Number(e.target.value))} />
            <Input label="CPU Max" type="number" min={1} required value={rules.cpu.max} onChange={(e) => set("cpu.max", Number(e.target.value))} />
            <Input label="CPU Step" type="number" min={1} required value={rules.cpu.step} onChange={(e) => set("cpu.step", Number(e.target.value))} />
            <Input label="RAM Min" type="number" min={1} required value={rules.ram.min} onChange={(e) => set("ram.min", Number(e.target.value))} />
            <Input label="RAM Max" type="number" min={1} required value={rules.ram.max} onChange={(e) => set("ram.max", Number(e.target.value))} />
            <Input label="RAM Step" type="number" min={1} required value={rules.ram.step} onChange={(e) => set("ram.step", Number(e.target.value))} />
            <Input label="Storage Min" type="number" min={1} required value={rules.storage.min} onChange={(e) => set("storage.min", Number(e.target.value))} />
            <Input label="Storage Max" type="number" min={1} required value={rules.storage.max} onChange={(e) => set("storage.max", Number(e.target.value))} />
            <Input label="Storage Step" type="number" min={1} required value={rules.storage.step} onChange={(e) => set("storage.step", Number(e.target.value))} />
          </FieldGrid>
        </FormCard>

        <Button type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan Formula Harga"}</Button>
      </form>
    </div>
  );
}
