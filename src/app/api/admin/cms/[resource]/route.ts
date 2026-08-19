import { api, fromZodError } from "@/lib/api/helpers";
import { getCmsResource, cmsColumnName, cmsNow } from "@/lib/cms/resources";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { newId } from "@/lib/utils";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/security";
import { sanitizeInput } from "@/lib/security";

/**
 * GENERIC CMS HANDLER — satu endpoint untuk semua resource CMS:
 * pages, faq, testimonials, blog, knowledgeBase, legal, announcements,
 * incidents, maintenance. RBAC + validasi per resource dari resource map.
 */
export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "content.view",
  handler: async ({ params }) => {
    const resource = getCmsResource(params.resource);
    if (!resource) throw new ApiError("Resource CMS tidak dikenali.", "INVALID_RESOURCE", 400);
    const rows = await table(resource.collection, getDriver()).find({}, { orderBy: [{ column: "updated_at", dir: "desc" }], limit: 500 });
    return Response.json({ success: true, data: { resource: resource.key, rows } });
  },
});

export const POST = api({
  methods: ["POST"],
  auth: "admin",
  permission: "content.manage",
  handler: async ({ request, params, user, ip }) => {
    const resource = getCmsResource(params.resource);
    if (!resource) throw new ApiError("Resource CMS tidak dikenali.", "INVALID_RESOURCE", 400);
    const body = sanitizeInput((await request.json().catch(() => null)) as unknown);
    const parsed = resource.schema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const data = resource.transform ? resource.transform(parsed.data as Record<string, unknown>) : (parsed.data as Record<string, unknown>);
    const row: Record<string, unknown> = { id: newId(), created_at: cmsNow(), updated_at: cmsNow() };
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) row[cmsColumnName(key)] = value;
    }
    if (resource.slugField) {
      const slug = String(row[resource.slugField]);
      const dup = await table(resource.collection, getDriver()).findOne({ [resource.slugField]: slug });
      if (dup) throw new ApiError("Slug sudah digunakan.", "DUPLICATE_SLUG", 409);
    }
    await table(resource.collection, getDriver()).insert(row);
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "create",
      resource: `cms:${resource.key}`,
      resourceId: String(row.id),
      ip,
      metadata: { title: data.title ?? data.question ?? data.slug ?? null },
    });
    return Response.json({ success: true, data: { id: row.id } });
  },
});
