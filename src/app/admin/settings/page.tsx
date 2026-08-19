"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { LoadingState } from "@/components/ui/state";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { AdminPageHeader, FormCard, FieldGrid } from "@/components/admin/admin-page";

interface SettingsData {
  settings: Record<string, string | boolean | number | number[] | string[]>;
  maintenanceMode?: boolean;
}

export default function AdminSettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingMaint, setSavingMaint] = useState(false);

  const load = useCallback(() => {
    apiFetch<SettingsData>("/api/admin/settings").then((res) => {
      if (res.success && res.data) setSettings(res.data.settings);
      else setError(res.error?.message ?? "Gagal memuat pengaturan.");
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key: string, value: unknown) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    const res = await apiFetch("/api/admin/settings", { method: "PATCH", body: JSON.stringify(settings) });
    setSaving(false);
    if (res.success) {
      toast.push("success", "Pengaturan disimpan (tercatat di audit log).");
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  const saveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSavingMaint(true);
    const res = await apiFetch("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({
        maintenanceEnabled: settings.maintenanceEnabled,
        maintenanceTitle: settings.maintenanceTitle,
        maintenanceMessage: settings.maintenanceMessage,
        maintenanceUntil: settings.maintenanceUntil,
        maintenanceAllowedPaths: settings.maintenanceAllowedPaths,
      }),
    });
    setSavingMaint(false);
    if (res.success) {
      toast.push("success", settings.maintenanceEnabled ? "Maintenance mode AKTIF." : "Maintenance mode nonaktif.");
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!settings) return <LoadingState />;

  const str = (k: string) => String(settings[k] ?? "");
  const bool = (k: string) => Boolean(settings[k]);

  return (
    <div className="max-w-3xl space-y-6">
      <AdminPageHeader title="Pengaturan Platform" description="Branding, kontak, maintenance mode, dan reminder." />

      <form onSubmit={save} className="space-y-5">
        <FormCard title="Tema & Branding">
          <FieldGrid>
            <Input label="Nama Situs" required value={str("siteName")} onChange={(e) => set("siteName", e.target.value)} />
            <Input label="Tagline" value={str("siteTagline")} onChange={(e) => set("siteTagline", e.target.value)} />
            <Input label="SEO Title" value={str("seoTitle")} onChange={(e) => set("seoTitle", e.target.value)} />
            <Input label="WhatsApp Nomor Bisnis" value={str("whatsappNumber")} onChange={(e) => set("whatsappNumber", e.target.value)} hint="Format internasional tanpa + (contoh 6281234567890). Dipakai untuk URL wa.me pesanan." />
          </FieldGrid>
          <Textarea label="Deskripsi Situs" rows={2} value={str("siteDescription")} onChange={(e) => set("siteDescription", e.target.value)} />
          <Textarea label="SEO Description" rows={2} value={str("seoDescription")} onChange={(e) => set("seoDescription", e.target.value)} />
        </FormCard>

        <FormCard title="Sosial & Kontak">
          <FieldGrid>
            <Input label="Discord URL" value={str("discordUrl")} onChange={(e) => set("discordUrl", e.target.value)} placeholder="https://discord.gg/…" />
            <Input label="Email Publik" value={str("emailPublic")} onChange={(e) => set("emailPublic", e.target.value)} placeholder="halo@wangstore.example" />
          </FieldGrid>
          <Textarea label="Catatan Kontak" rows={2} value={str("contactNote")} onChange={(e) => set("contactNote", e.target.value)} />
        </FormCard>

        <FormCard title="Reminder Layanan">
          <FieldGrid>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={bool("remindersEnabled")} onChange={(e) => set("remindersEnabled", e.target.checked)} className="h-4 w-4 accent-accent" />
              Aktifkan reminder otomatis
            </label>
            <Input
              label="Interval (hari sebelum kedaluwarsa, pisahkan koma)"
              value={String((settings.reminderIntervals as number[])?.join(",") ?? "7,3,1")}
              onChange={(e) => set("reminderIntervals", e.target.value.split(",").map((v) => Number(v.trim())).filter((n) => !Number.isNaN(n) && n >= 0 && n <= 90))}
            />
          </FieldGrid>
        </FormCard>

        <Button type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan Pengaturan"}</Button>
      </form>

      <form onSubmit={saveMaintenance} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Mode Maintenance</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={bool("maintenanceEnabled")} onChange={(e) => set("maintenanceEnabled", e.target.checked)} className="h-4 w-4 accent-accent" />
          Aktifkan maintenance mode
        </label>
        {bool("maintenanceEnabled") && (
          <>
            <Input label="Judul" value={str("maintenanceTitle")} onChange={(e) => set("maintenanceTitle", e.target.value)} />
            <Textarea label="Pesan" rows={2} value={str("maintenanceMessage")} onChange={(e) => set("maintenanceMessage", e.target.value)} />
            <Input label="Perkiraan selesai (ISO, opsional)" value={str("maintenanceUntil")} onChange={(e) => set("maintenanceUntil", e.target.value)} placeholder="2026-12-31T23:59:00.000Z" />
            <Input
              label="Jalur yang diizinkan (pisahkan koma)"
              value={String((settings.maintenanceAllowedPaths as string[])?.join(",") ?? "")}
              onChange={(e) => set("maintenanceAllowedPaths", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))}
            />
            <Alert tone="info">Staf (owner/admin/staff) tetap dapat mengakses semua halaman saat maintenance aktif.</Alert>
          </>
        )}
        <Button type="submit" variant={bool("maintenanceEnabled") ? "danger" : "primary"} disabled={savingMaint}>
          {savingMaint ? "Menyimpan…" : bool("maintenanceEnabled") ? "Aktifkan Maintenance" : "Simpan Pengaturan Maintenance"}
        </Button>
      </form>
    </div>
  );
}
