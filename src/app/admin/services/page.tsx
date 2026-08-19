"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/api";
import { formatDateTime } from "@/lib/utils/format";
import { ServiceStatusBadge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { Pagination } from "@/components/ui/data";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AdminPageHeader, SERVICE_STATUS_LABEL } from "@/components/admin/admin-page";
import type { ServiceInstance } from "@/lib/types";

export default function AdminServicesPage() {
  const toast = useToast();
  const [services, setServices] = useState<(ServiceInstance & { customerEmail: string | null })[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.set("status", status);
    apiFetch<{ services: (ServiceInstance & { customerEmail: string | null })[]; total: number }>(`/api/admin/services?${params.toString()}`).then((res) => {
      if (res.success && res.data) {
        setServices(res.data.services);
        setTotal(res.data.total);
      } else setError(res.error?.message ?? "Gagal memuat layanan.");
    });
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  const runReminders = async () => {
    const res = await apiFetch<{ sent: number }>("/api/admin/reminders", { method: "POST" });
    if (res.success) toast.push("success", `Reminder diproses (${res.data?.sent ?? 0} terkirim).`);
    else toast.push("error", res.error?.message ?? "Gagal menjalankan reminder.");
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Layanan"
        description="Siklus hidup layanan pelanggan: aktivasi, kedaluwarsa, perpanjangan."
        action={
          <Button variant="secondary" size="sm" onClick={runReminders}>
            Jalankan Reminder Sekarang
          </Button>
        }
      />
      <select
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }}
        className="rounded-lg border border-border bg-bg px-3 py-2 text-sm"
        aria-label="Filter status layanan"
      >
        <option value="">Semua status</option>
        {Object.entries(SERVICE_STATUS_LABEL).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!services && !error && <LoadingState />}
      {services && services.length === 0 && <EmptyState title="Belum ada layanan" description="Layanan dibuat saat pesanan dikonfirmasi." />}
      {services && services.length > 0 && (
        <>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {services.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/services/${s.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-surface-muted">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="truncate text-xs text-muted">
                      {s.service_number} · {s.customerEmail ?? "tanpa akun"} · {s.service_type}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted">
                    <p>Aktivasi: {formatDateTime(s.activation_at)}</p>
                    <p>Berakhir: {formatDateTime(s.expires_at)}</p>
                  </div>
                  <ServiceStatusBadge status={s.status} />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} total={total} pageSize={pageSize} onPage={setPage} />
        </>
      )}
    </div>
  );
}
