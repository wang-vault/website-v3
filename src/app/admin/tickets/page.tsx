"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/api";
import { formatDateTime } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { AdminPageHeader } from "@/components/admin/admin-page";
import type { Ticket } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = { open: "Terbuka", answered: "Dijawab", customer_reply: "Balasan Pelanggan", closed: "Ditutup" };
const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "error" | "info" | "accent"> = {
  open: "warning",
  answered: "info",
  customer_reply: "accent",
  closed: "neutral",
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = status ? `?status=${status}` : "";
    apiFetch<{ tickets: Ticket[] }>(`/api/admin/tickets${params}`).then((res) => {
      if (res.success && res.data) setTickets(res.data.tickets);
      else setError(res.error?.message ?? "Gagal memuat tiket.");
    });
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Tiket & Kontak" description="Tiket dukungan dan pesan kontak dari pelanggan." />
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" aria-label="Filter status tiket">
        <option value="">Semua status</option>
        {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!tickets && !error && <LoadingState />}
      {tickets && tickets.length === 0 && <EmptyState title="Belum ada tiket" />}
      {tickets && tickets.length > 0 && (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/tickets/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-surface-muted">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t.subject}</p>
                  <p className="truncate text-xs text-muted">
                    {t.ticket_number} · {t.name} ({t.email}) · {t.category} · prioritas {t.priority}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{formatDateTime(t.updated_at)}</span>
                  <Badge tone={STATUS_TONE[t.status] ?? "neutral"}>{STATUS_LABEL[t.status] ?? t.status}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
