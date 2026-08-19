import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/security";
import type { Order, Profile, ServiceInstance, User } from "@/lib/types";

export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "customers.view",
  handler: async ({ params }) => {
    const driver = getDriver();
    const [user, profile, orders, services] = await Promise.all([
      table<User>("users", driver).findById(params.id),
      table<Profile>("profiles", driver).findOne({ user_id: params.id }),
      table<Order>("orders", driver).find({ user_id: params.id }, { orderBy: [{ column: "created_at", dir: "desc" }] }),
      table<ServiceInstance>("service_instances", driver).find({ customer_id: params.id }, { orderBy: [{ column: "created_at", dir: "desc" }] }),
    ]);
    if (!user) throw new ApiError("Pelanggan tidak ditemukan.", "NOT_FOUND", 404);
    const role = await table("roles", driver).findById(user.role_id);
    return Response.json({
      success: true,
      data: {
        customer: {
          id: user.id,
          email: user.email,
          status: user.status,
          emailVerified: !!user.email_verified_at,
          roleSlug: String(role?.slug ?? "customer"),
          createdAt: user.created_at,
        },
        profile,
        orders,
        services,
      },
    });
  },
});

/** PATCH — ubah status akun pelanggan (aktif/nonaktif). */
export const PATCH = api({
  methods: ["PATCH"],
  auth: "admin",
  permission: "customers.update",
  handler: async ({ request, params, user, ip }) => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const driver = getDriver();
    const target = await table<User>("users", driver).findById(params.id);
    if (!target) throw new ApiError("Pelanggan tidak ditemukan.", "NOT_FOUND", 404);
    if (String(target.id) === user.id) {
      throw new ApiError("Anda tidak dapat mengubah akun sendiri di sini.", "FORBIDDEN", 403);
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body?.status === "active" || body?.status === "disabled") patch.status = body.status;
    const updated = await table<User>("users", driver).update(target.id, patch);
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "customer.update",
      resource: "customer",
      resourceId: target.id,
      ip,
      metadata: { patch: Object.keys(patch) },
    });
    return Response.json({ success: true, data: { customer: updated } });
  },
});
