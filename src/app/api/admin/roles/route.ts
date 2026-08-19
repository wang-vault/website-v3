import { api, fromZodError } from "@/lib/api/helpers";
import { rolePermissionSchema } from "@/lib/validation/admin";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/security";
import type { Permission, Role, RolePermission } from "@/lib/types";

/** GET — matriks permission (owner/admin/staff). */
export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "roles.manage",
  handler: async () => {
    const driver = getDriver();
    const [roles, permissions, rolePermissions] = await Promise.all([
      table<Role>("roles", driver).find({ is_system: true }),
      table<Permission>("permissions", driver).all({ orderBy: [{ column: "module", dir: "asc" }] }),
      table<RolePermission>("role_permissions", driver).all(),
    ]);
    const rpMap = new Map<string, Set<string>>();
    for (const rp of rolePermissions) {
      const set = rpMap.get(String(rp.role_id)) ?? new Set<string>();
      set.add(String(rp.permission_id));
      rpMap.set(String(rp.role_id), set);
    }
    return Response.json({
      success: true,
      data: {
        roles: roles.map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          permissions: [...(rpMap.get(r.id) ?? [])],
        })),
        permissions,
      },
    });
  },
});

/** PATCH — set permission untuk role admin/staff (khusus OWNER). */
export const PATCH = api({
  methods: ["PATCH"],
  auth: "admin",
  permission: "roles.manage",
  handler: async ({ request, user, ip }) => {
    if (!user.permissions.has("roles.manage")) {
      throw new ApiError("Hanya Owner yang dapat mengubah permission.", "FORBIDDEN", 403);
    }
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = rolePermissionSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const driver = getDriver();
    const role = await table<Role>("roles", driver).findOne({ slug: parsed.data.roleSlug });
    if (!role) throw new ApiError("Role tidak ditemukan.", "ROLE_NOT_FOUND", 404);

    const perms = await table<Permission>("permissions", driver).find({ key: { op: "in", value: parsed.data.permissions } });
    const permIds = new Set(perms.map((p) => p.id));
    if (permIds.size !== parsed.data.permissions.length) {
      throw new ApiError("Ada permission yang tidak dikenal.", "INVALID_PERMISSION", 400);
    }

    await driver.tx(async (tx) => {
      await table<RolePermission>("role_permissions", tx).removeWhere({ role_id: role.id });
      for (const pid of permIds) {
        await table<RolePermission>("role_permissions", tx).insert({
          id: (await import("@/lib/utils")).newId(),
          role_id: role.id,
          permission_id: pid,
          created_at: new Date().toISOString(),
        });
      }
    });
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "roles.update",
      resource: "role",
      resourceId: role.id,
      ip,
      metadata: { role: role.slug, permissions: parsed.data.permissions },
    });
    return Response.json({ success: true, data: { message: "Permission diperbarui." } });
  },
});
