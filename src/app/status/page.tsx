import type { Metadata } from "next";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { getSettings } from "@/lib/settings";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/format";
import type { Incident, MaintenanceWindow } from "@/lib/types";

export const metadata: Metadata = {
  title: "Status Layanan",
  description: "Status platform, insiden, dan jadwal maintenance WangStore.",
};

export const revalidate = 60;

const SEVERITY_LABEL: Record<string, string> = { degraded: "Penurunan Kinerja", major: "Gangguan Besar" };
const STATUS_LABEL: Record<string, string> = {
  investigating: "Diselidiki",
  identified: "Ditemukan",
  monitoring: "Dipantau",
  resolved: "Selesai",
};

export default async function StatusPage() {
  const driver = getDriver();
  const settings = await getSettings();
  const now = new Date().toISOString();

  const [activeIncidents, resolvedIncidents, windows] = await Promise.all([
    table<Incident>("incidents", driver).find({ status: { op: "ne", value: "resolved" } }, { orderBy: [{ column: "started_at", dir: "desc" }] }),
    table<Incident>("incidents", driver).find({ status: "resolved" }, { orderBy: [{ column: "resolved_at", dir: "desc" }], limit: 10 }),
    table<MaintenanceWindow>("maintenance_windows", driver).find(
      { status: { op: "in", value: ["scheduled", "active"] }, ends_at: { op: "gte", value: now } },
      { orderBy: [{ column: "starts_at", dir: "asc" }] },
    ),
  ]);

  const platform = settings.maintenanceEnabled ? "maintenance" : activeIncidents.length > 0 ? "degraded" : "operational";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Status Layanan</h1>
      <p className="mt-2 text-secondary">
        Halaman ini menampilkan kondisi platform WangStore, insiden, dan jadwal maintenance. Diperbarui otomatis.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Platform WangStore</h2>
            <p className="mt-0.5 text-sm text-secondary">Pemesanan, akun, dan dashboard</p>
          </div>
          {platform === "operational" && <Badge tone="success">Beroperasi Normal</Badge>}
          {platform === "degraded" && <Badge tone="warning">Gangguan</Badge>}
          {platform === "maintenance" && <Badge tone="info">Maintenance</Badge>}
        </div>
        <p className="mt-3 text-xs text-muted">
          Infrastruktur hosting pelanggan dikelola penyedia di luar platform; statusnya ditampilkan bila tersedia.
          Uptime aktual akan ditampilkan setelah monitoring aktif — kami tidak menampilkan angka uptime palsu.
        </p>
      </div>

      {windows.length > 0 && (
        <section className="mt-8" aria-label="Jadwal maintenance">
          <h2 className="text-xl font-semibold">Jadwal Maintenance</h2>
          <div className="mt-3 space-y-3">
            {windows.map((w) => (
              <div key={w.id} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{w.title}</h3>
                  <Badge tone={w.status === "active" ? "info" : "neutral"}>
                    {w.status === "active" ? "Berlangsung" : "Terjadwal"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-secondary">{w.message}</p>
                <p className="mt-2 text-xs text-muted">
                  {formatDateTime(w.starts_at)} — {formatDateTime(w.ends_at)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8" aria-label="Insiden">
        <h2 className="text-xl font-semibold">Insiden</h2>
        {activeIncidents.length === 0 && resolvedIncidents.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-secondary">
            Belum ada insiden yang tercatat.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {activeIncidents.map((inc) => (
              <div key={inc.id} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{inc.title}</h3>
                  <Badge tone={inc.severity === "major" ? "error" : "warning"}>
                    {SEVERITY_LABEL[inc.severity] ?? inc.severity} · {STATUS_LABEL[inc.status] ?? inc.status}
                  </Badge>
                </div>
                <div className="mt-2 text-sm">
                  <Markdown content={inc.message_md} />
                </div>
                <p className="mt-2 text-xs text-muted">Dimulai: {formatDateTime(inc.started_at)}</p>
              </div>
            ))}
            {resolvedIncidents.map((inc) => (
              <div key={inc.id} className="rounded-2xl border border-border bg-surface p-5 opacity-80">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{inc.title}</h3>
                  <Badge tone="success">Selesai</Badge>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {formatDateTime(inc.started_at)} — {formatDateTime(inc.resolved_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
