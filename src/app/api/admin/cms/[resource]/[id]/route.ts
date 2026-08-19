import { api } from "@/lib/api/helpers";
import { getCmsResource, cmsColumnName, cmsNow } from "@/lib/cms/resources";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/security";
import { sanitizeInput } from "@/lib/security";

export const PATCH = api({
  methods: ["PATCH"],
  auth: "admin",
  permission: "content.manage",
  handler: async ({ request, params, user, ip }) => {
    const resource = getCmsResource(params.resource);
    if (!resource) throw new ApiError("Resource CMS tidak dikenali.", "INVALID_RESOURCE", 400);
    const body = sanitizeInput((await request.json().catch(() => null)) as unknown) as Record<string, unknown>;

    const driver = getDriver();
    const collection = table(resource.collection, driver);
    const existing = await collection.findById(params.id);
    if (!existing) throw new ApiError("Data tidak ditemukan.", "NOT_FOUND", 404);

    // Whitelist field yang boleh diedit
    const patch: Record<string, unknown> = { updated_at: cmsNow() };
    for (const field of resource.editableFields) {
      const incoming = body[cmsColumnName(field)] ?? body[field];
      if (incoming !== undefined) patch[field] = incoming;
    }
    if (resource.slugField && patch[resource.slugField]) {
      const dup = await collection.findOne({ [resource.slugField]: patch[resource.slugField] });
      if (dup && String(dup.id) !== params.id) {
        throw new ApiError("Slug sudah digunakan.", "DUPLICATE_SLUG", 409);
      }
    }
    const transformed = resource.transform ? resource.transform(patch as Record<string, unknown>) : patch;
    const dbPatch: Record<string, unknown> = { updated_at: cmsNow() };
    for (const [key, value] of Object.entries(transformed)) {
      dbPatch[cmsColumnName(key)] = value;
    }
    const updated = await collection.update(params.id, dbPatch);
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "update",
      resource: `cms:${resource.key}`,
      resourceId: params.id,
      ip,
      metadata: { fields: Object.keys(dbPatch).filter((f) => f !== "updated_at") },
    });
    return Response.json({ success: true, data: { row: updated } });
  },
});

export const DELETE = api({
  methods: ["DELETE"],
  auth: "admin",
  permission: "content.manage",
  handler: async ({ params, user, ip }) => {
    const resource = getCmsResource(params.resource);
    if (!resource) throw new ApiError("Resource CMS tidak dikenali.", "INVALID_RESOURCE", 400);
    const driver = getDriver();
    const collection = table(resource.collection, driver);
    const existing = await collection.findById(params.id);
    if (!existing) throw new ApiError("Data tidak ditemukan.", "NOT_FOUND", 404);
    await collection.remove(params.id);
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "delete",
      resource: `cms:${resource.key}`,
      resourceId: params.id,
      ip,
    });
    return Response.json({ success: true, data: { message: "Dihapus." } });
  },
});
