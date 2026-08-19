"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { formatDateTime } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { Pagination } from "@/components/ui/data";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AdminPageHeader } from "@/components/admin/admin-page";

interface CustomerRow {
  id: string;
  email: string;
  fullName: string;
  whatsapp: string;
  roleSlug: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
}

export default function AdminCustomersPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q.trim()) params.set("q", q.trim());
    apiFetch<{ customers: CustomerRow[]; total: number }>(`/api/admin/customers?${params.toString()}`).then((res) => {
      if (res.success && res.data) {
        setCustomers(res.data.customers);
        setTotal(res.data.total);
      } else setError(res.error?.message ?? "Gagal memuat pelanggan.");
    });
  }, [page, q]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleStatus = async (c: CustomerRow) => {
    const next = c.status === "active" ? "disabled" : "active";
    const res = await apiFetch(`/api/admin/customers/${c.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    if (res.success) {
      toast.push("success", `Akun ${c.email} ${next === "active" ? "diaktifkan" : "dinonaktifkan"}.`);
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Pelanggan" description="Daftar akun pengguna platform." />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        placeholder="Cari nama/email/WhatsApp…"
        className="w-64 rounded-lg border border-border bg-bg px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-accent"
        aria-label="Cari pelanggan"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!customers && !error && <LoadingState />}
      {customers && customers.length === 0 && <EmptyState title="Belum ada pelanggan" />}
      {customers && customers.length > 0 && (
        <>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {customers.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <Link href={`/admin/customers/${c.id}`} className="text-sm font-semibold hover:underline">
                    {c.fullName || c.email}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    {c.email} · {c.whatsapp || "no WA"} · bergabung {formatDateTime(c.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={c.roleSlug === "owner" ? "accent" : c.roleSlug === "admin" ? "info" : c.roleSlug === "staff" ? "warning" : "neutral"}>
                    {c.roleSlug}
                  </Badge>
                  <Badge tone={c.status === "active" ? "success" : "error"}>{c.status === "active" ? "Aktif" : "Nonaktif"}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => toggleStatus(c)}>
                    {c.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} total={total} pageSize={pageSize} onPage={setPage} />
        </>
      )}
    </div>
  );
}
