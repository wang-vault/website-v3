"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { formatDateTime } from "@/lib/utils/format";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { Pagination } from "@/components/ui/data";
import { AdminPageHeader } from "@/components/admin/admin-page";

interface AuditRow {
  id: string;
  actor_type: string;
  actor_email: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [resource, setResource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pageSize = 25;

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (resource) params.set("resource", resource);
    apiFetch<{ logs: AuditRow[]; total: number }>(`/api/admin/audit-logs?${params.toString()}`).then((res) => {
      if (res.success && res.data) {
        setLogs(res.data.logs);
        setTotal(res.data.total);
      } else setError(res.error?.message ?? "Gagal memuat audit log.");
    });
  }, [page, resource]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Audit Log"
        description="Catatan seluruh operasi sensitif. Password dan secret tidak pernah disimpan di sini."
      />
      <select value={resource} onChange={(e) => { setResource(e.target.value); setPage(1); }} className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" aria-label="Filter resource">
        <option value="">Semua resource</option>
        {["order", "service", "user", "coupon", "server_package", "vps_package", "vps_location", "pricing_rules", "settings", "ticket", "auth", "cms", "role", "customer", "saved_configuration", "service_renewal", "service_reminders", "profile"].map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!logs && !error && <LoadingState />}
      {logs && logs.length === 0 && <EmptyState title="Belum ada audit log" description="Aktivitas akan tercatat di sini." />}
      {logs && logs.length > 0 && (
        <>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {logs.map((l) => (
              <li key={l.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">{l.action}</span>{" "}
                    <span className="text-muted">→ {l.resource}</span>
                    {l.resource_id && <span className="ml-1 font-mono text-xs text-muted">{l.resource_id.slice(0, 8)}…</span>}
                  </p>
                  <span className="text-xs text-muted">{formatDateTime(l.created_at)}</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {l.actor_email ?? l.actor_type} · IP {l.ip ?? "—"}
                </p>
                {l.metadata && Object.keys(l.metadata).length > 0 && (
                  <pre className="mt-1.5 overflow-x-auto rounded-lg bg-surface-muted p-2 text-[11px] text-secondary">
                    {JSON.stringify(l.metadata, null, 1)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} total={total} pageSize={pageSize} onPage={setPage} />
        </>
      )}
    </div>
  );
}
