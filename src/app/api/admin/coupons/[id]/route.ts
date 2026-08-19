import { api, fromZodError } from "@/lib/api/helpers";
import { couponSchema } from "@/lib/validation/admin";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { nowIso } from "@/lib/utils";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/security";
import type { Coupon } from "@/lib/types";

export const PATCH = api({
  methods: ["PATCH"],
  auth: "admin",
  permission: "coupons.manage",
  handler: async ({ request, params, user, ip }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = couponSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const driver = getDriver();
    const coupons = table<Coupon>("coupons", driver);
    const existing = await coupons.findById(params.id);
    if (!existing) throw new ApiError("Kupon tidak ditemukan.", "NOT_FOUND", 404);
    const dup = await coupons.findOne({ code: parsed.data.code });
    if (dup && String(dup.id) !== params.id) throw new ApiError("Kode kupon sudah digunakan.", "DUPLICATE_CODE", 409);

    const patch = {
      code: parsed.data.code,
      type: parsed.data.type,
      value: parsed.data.value,
      min_order: parsed.data.minOrder,
      max_usage: parsed.data.maxUsage ?? null,
      usage_per_customer: parsed.data.usagePerCustomer ?? null,
      starts_at: parsed.data.startsAt ?? null,
      expires_at: parsed.data.expiresAt ?? null,
      active: parsed.data.active,
      applicable_tiers: parsed.data.applicableTiers ?? null,
      applicable_product_types: parsed.data.applicableProductTypes ?? null,
      updated_at: nowIso(),
    };
    const updated = await coupons.update(existing.id, patch);
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "update",
      resource: "coupon",
      resourceId: existing.id,
      ip,
      metadata: { code: patch.code, active: patch.active, value: patch.value },
    });
    return Response.json({ success: true, data: { coupon: updated } });
  },
});

export const DELETE = api({
  methods: ["DELETE"],
  auth: "admin",
  permission: "coupons.manage",
  handler: async ({ params, user, ip }) => {
    const driver = getDriver();
    const coupons = table<Coupon>("coupons", driver);
    const existing = await coupons.findById(params.id);
    if (!existing) throw new ApiError("Kupon tidak ditemukan.", "NOT_FOUND", 404);
    await coupons.remove(existing.id);
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "delete",
      resource: "coupon",
      resourceId: existing.id,
      ip,
      metadata: { code: existing.code },
    });
    return Response.json({ success: true, data: { message: "Kupon dihapus." } });
  },
});
