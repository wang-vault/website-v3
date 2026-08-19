import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { ApiError } from "@/lib/security";
import type { ServiceInstance, ServiceReminder } from "@/lib/types";

export const GET = api({
  methods: ["GET"],
  auth: "required",
  handler: async ({ params, user }) => {
    const driver = getDriver();
    const service = await table<ServiceInstance>("service_instances", driver).findById(params.id);
    if (!service) throw new ApiError("Layanan tidak ditemukan.", "SERVICE_NOT_FOUND", 404);
    if (String(service.customer_id) !== user.id && !["owner", "admin", "staff"].includes(user.roleSlug)) {
      throw new ApiError("Akses ditolak.", "FORBIDDEN", 403);
    }
    const reminders = await table<ServiceReminder>("service_reminders", driver).find(
      { service_id: service.id },
      { orderBy: [{ column: "scheduled_at", dir: "asc" }] },
    );
    return Response.json({ success: true, data: { reminders } });
  },
});
