"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { formatIDR } from "@/lib/utils/format";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { SavedConfiguration } from "@/lib/types";

export default function SavedConfigsPage() {
  const router = useRouter();
  const toast = useToast();
  const [configs, setConfigs] = useState<SavedConfiguration[] | null>(null);
  const [toDelete, setToDelete] = useState<SavedConfiguration | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    apiFetch<{ configurations: SavedConfiguration[] }>("/api/account/saved-configs").then((res) => {
      if (res.success && res.data) setConfigs(res.data.configurations);
      else setError("Gagal memuat konfigurasi.");
    });
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async () => {
    if (!toDelete) return;
    const res = await apiFetch(`/api/account/saved-configs/${toDelete.id}`, { method: "DELETE" });
    if (res.success) {
      toast.push("success", "Konfigurasi dihapus.");
      load();
    } else {
      toast.push("error", apiErrorMessage(res));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Konfigurasi Tersimpan</h1>
        <p className="mt-1 text-sm text-secondary">
          Konfigurasi tersimpan di akun Anda. Konfigurasi guest tersimpan di perangkat (browser storage) dan dapat
          dimuat ulang di Server Builder.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!configs && !error && <LoadingState />}
      {configs && configs.length === 0 && (
        <EmptyState
          title="Belum ada konfigurasi tersimpan"
          description="Buka Server Builder, atur spesifikasi, lalu klik Simpan Konfigurasi."
          action={
            <Link href="/server-builder" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:opacity-90">
              Buka Server Builder
            </Link>
          }
        />
      )}
      {configs && configs.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {configs.map((c) => (
            <li key={c.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="mt-1 text-sm text-secondary">
                    Tier {c.tier_slug === "low" ? "Low" : c.tier_slug === "medium" ? "Medium" : "High"} · {c.cpu} vCore · {c.ram} GB · {c.storage} GB
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">{formatIDR(Number(c.price))}<span className="text-xs font-normal text-muted">/bln</span></p>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/server-builder?load=${c.id}`)}
                  className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-bg hover:opacity-90"
                >
                  Muat di Builder
                </button>
                <button
                  type="button"
                  onClick={() => setToDelete(c)}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-red-600 hover:bg-surface-muted"
                >
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        title="Hapus konfigurasi?"
        message={`Konfigurasi "${toDelete?.name}" akan dihapus dari akun Anda.`}
      />
    </div>
  );
}
