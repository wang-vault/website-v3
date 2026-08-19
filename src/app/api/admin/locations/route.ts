import { api, fromZodError } from "@/lib/api/helpers";
import { locationSchema } from "@/lib/validation/admin";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { newId, nowIso } from "@/lib/utils";
import { auditLog } from "@/lib/audit";
import type { VpsLocation } from "@/lib/types";

export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "vps.view",
  handler: async () => {
    const rows = await table<VpsLocation>("vps_locations", getDriver()).all({ orderBy: [{ column: "name", dir: "asc" }] });
    return Response.json({ success: true, data: { locations: rows } });
  },
});

export const POST = api({
  methods: ["POST"],
  auth: "admin",
  permission: "vps.manage",
  handler: async ({ request, user, ip }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = locationSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);
    const loc: VpsLocation = {
      id: newId(),
      name: parsed.data.name,
      country: parsed.data.country ?? "",
      city: parsed.data.city ?? "",
      status: parsed.data.status,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await table("vps_locations", getDriver()).insert(loc);
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "create",
      resource: "vps_location",
      resourceId: loc.id,
      ip,
      metadata: { name: loc.name },
    });
    return Response.json({ success: true, data: { location: loc } });
  },
});
