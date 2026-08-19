import { api, fromZodError } from "@/lib/api/helpers";
import { userPatchSchema } from "@/lib/validation/admin";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { nowIso } from "@/lib/utils";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/security";
import type { Role, User } from "@/lib/types";

/** PATCH — ubah role (khusus owner: roles.manage) atau status (admin: users.manage). */
export const PATCH = api({
  methods: ["PATCH"],
  auth: "admin",
  permission: "users.manage",
  handler: async ({ request, params, user, ip }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = userPatchSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const driver = getDriver();
    const target = await table<User>("users", driver).findById(params.id);
    if (!target) throw new ApiError("User tidak ditemukan.", "NOT_FOUND", 404);
    if (String(target.id) === user.id) {
      throw new ApiError("Anda tidak dapat mengubah akun sendiri di sini.", "FORBIDDEN", 403);
    }
    const targetRole = await table<Role>("roles", driver).findById(target.role_id);
    const targetSlug = String(targetRole?.slug ?? "customer");

    const patch: Record<string, unknown> = { updated_at: nowIso() };
    const meta: Record<string, unknown> = {};

    if (parsed.data.roleSlug && parsed.data.roleSlug !== targetSlug) {
      // Mengubah role = tindakan Owner-only (roles.manage).
      if (!user.permissions.has("roles.manage")) {
        throw new ApiError("Hanya Owner yang dapat mengubah role.", "FORBIDDEN", 403);
      }
      const newRole = await table<Role>("roles", driver).findOne({ slug: parsed.data.roleSlug });
      if (!newRole) throw new ApiError("Role tidak ditemukan.", "ROLE_NOT_FOUND", 404);
      patch.role_id = newRole.id;
      meta.previousRole = targetSlug;
      meta.newRole = parsed.data.roleSlug;
    }
    if (parsed.data.status && parsed.data.status !== target.status) {
      patch.status = parsed.data.status;
      meta.previousStatus = target.status;
      meta.newStatus = parsed.data.status;
    }

    await table<User>("users", driver).update(target.id, patch);
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "user.update",
      resource: "user",
      resourceId: target.id,
      ip,
      metadata: meta,
    });
    return Response.json({ success: true, data: { message: "User diperbarui.", changes: meta } });
  },
});
