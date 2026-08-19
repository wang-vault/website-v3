import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { refreshServiceStatuses } from "@/lib/services/lifecycle";
import type { ServiceInstance } from "@/lib/types";

/** GET /api/services — layanan milik customer yang sedang login. */
export const GET = api({
  methods: ["GET"],
  auth: "required",
  handler: async ({ user }) => {
    await refreshServiceStatuses();
    const rows = await table<ServiceInstance>("service_instances", getDriver()).find(
      { customer_id: user.id },
      { orderBy: [{ column: "created_at", dir: "desc" }] },
    );
    return Response.json({ success: true, data: { services: rows } });
  },
});
