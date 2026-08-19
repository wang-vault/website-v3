import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { refreshServiceStatuses } from "@/lib/services/lifecycle";
import { ApiError } from "@/lib/security";
import type { ServiceInstance, ServiceRenewal } from "@/lib/types";

export const GET = api({
  methods: ["GET"],
  auth: "required",
  handler: async ({ params, user }) => {
    await refreshServiceStatuses();
    const driver = getDriver();
    const service = await table<ServiceInstance>("service_instances", driver).findById(params.id);
    if (!service) throw new ApiError("Layanan tidak ditemukan.", "SERVICE_NOT_FOUND", 404);
    const isOwner = String(service.customer_id) === user.id;
    const isStaff = ["owner", "admin", "staff"].includes(user.roleSlug);
    if (!isOwner && !isStaff) throw new ApiError("Akses ditolak.", "FORBIDDEN", 403);
    const renewals = await table<ServiceRenewal>("service_renewals", driver).find(
      { service_id: service.id },
      { orderBy: [{ column: "created_at", dir: "desc" }] },
    );
    return Response.json({ success: true, data: { service, renewals } });
  },
});
