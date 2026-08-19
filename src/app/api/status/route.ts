import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { getSettings } from "@/lib/settings";
import type { Incident, MaintenanceWindow } from "@/lib/types";

/** GET /api/status — status platform, insiden, maintenance (data asli dari DB). */
export const GET = api({
  methods: ["GET"],
  handler: async () => {
    const driver = getDriver();
    const now = new Date();
    const nowIso = now.toISOString();
    const settings = await getSettings();

    const activeIncidents = await table<Incident>("incidents", driver).find(
      { status: { op: "ne", value: "resolved" } },
      { orderBy: [{ column: "started_at", dir: "desc" }] },
    );
    const resolvedIncidents = await table<Incident>("incidents", driver).find(
      { status: "resolved" },
      { orderBy: [{ column: "resolved_at", dir: "desc" }], limit: 10 },
    );
    const upcomingWindows = await table<MaintenanceWindow>("maintenance_windows", driver).find(
      { status: { op: "in", value: ["scheduled", "active"] }, ends_at: { op: "gte", value: nowIso } },
      { orderBy: [{ column: "starts_at", dir: "asc" }], limit: 10 },
    );

    const platformStatus = settings.maintenanceEnabled
      ? "maintenance"
      : activeIncidents.length > 0
        ? "degraded"
        : "operational";

    return Response.json({
      success: true,
      data: {
        platformStatus,
        maintenanceMode: settings.maintenanceEnabled,
        checkedAt: nowIso,
        services: [
          { name: "Platform (pemesanan & akun)", status: settings.maintenanceEnabled ? "maintenance" : "operational" },
          { name: "Katalog & Server Builder", status: "operational" },
          { name: "Status infrastruktur hosting", status: "unknown", note: "Dikelola penyedia di luar platform — detail belum tersedia." },
        ],
        incidents: {
          active: activeIncidents,
          history: resolvedIncidents,
        },
        maintenanceWindows: upcomingWindows,
        uptime: null, // Tidak menampilkan uptime palsu; data tersedia setelah monitoring aktif.
      },
    });
  },
});
