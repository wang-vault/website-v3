import { api, fromZodError } from "@/lib/api/helpers";
import { locationSchema } from "@/lib/validation/admin";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { nowIso } from "@/lib/utils";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/security";
import type { VpsLocation } from "@/lib/types";

export const PATCH = api({
  methods: ["PATCH"],
  auth: "admin",
  permission: "vps.manage",
  handler: async ({ request, params, user, ip }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = locationSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);
    const driver = getDriver();
    const existing = await table<VpsLocation>("vps_locations", driver).findById(params.id);
    if (!existing) throw new ApiError("Lokasi tidak ditemukan.", "NOT_FOUND", 404);
    const updated = await table<VpsLocation>("vps_locations", driver).update(existing.id, {
      name: parsed.data.name,
      country: parsed.data.country ?? "",
      city: parsed.data.city ?? "",
      status: parsed.data.status,
      updated_at: nowIso(),
    });
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "update",
      resource: "vps_location",
      resourceId: existing.id,
      ip,
    });
    return Response.json({ success: true, data: { location: updated } });
  },
});

export const DELETE = api({
  methods: ["DELETE"],
  auth: "admin",
  permission: "vps.manage",
  handler: async ({ params, user, ip }) => {
    const driver = getDriver();
    const existing = await table<VpsLocation>("vps_locations", driver).findById(params.id);
    if (!existing) throw new ApiError("Lokasi tidak ditemukan.", "NOT_FOUND", 404);
    await table<VpsLocation>("vps_locations", driver).update(existing.id, { status: "inactive", updated_at: nowIso() });
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "deactivate",
      resource: "vps_location",
      resourceId: existing.id,
      ip,
    });
    return Response.json({ success: true, data: { message: "Lokasi dinonaktifkan." } });
  },
});
