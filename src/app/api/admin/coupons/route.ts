import { api, fromZodError } from "@/lib/api/helpers";
import { couponSchema } from "@/lib/validation/admin";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { newId, nowIso } from "@/lib/utils";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/security";
import type { Coupon } from "@/lib/types";

export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "coupons.view",
  handler: async () => {
    const driver = getDriver();
    const [rows, usages] = await Promise.all([
      table<Coupon>("coupons", driver).all({ orderBy: [{ column: "created_at", dir: "desc" }] }),
      table("coupon_usages", driver).all(),
    ]);
    const usageCount = new Map<string, number>();
    for (const u of usages) {
      usageCount.set(String(u.coupon_id), (usageCount.get(String(u.coupon_id)) ?? 0) + 1);
    }
    return Response.json({
      success: true,
      data: {
        coupons: rows.map((c) => ({ ...c, usedCount: usageCount.get(c.id) ?? 0 })),
      },
    });
  },
});

export const POST = api({
  methods: ["POST"],
  auth: "admin",
  permission: "coupons.manage",
  handler: async ({ request, user, ip }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = couponSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const driver = getDriver();
    const existing = await table<Coupon>("coupons", driver).findOne({ code: parsed.data.code });
    if (existing) throw new ApiError("Kode kupon sudah digunakan.", "DUPLICATE_CODE", 409);

    const coupon: Coupon = {
      id: newId(),
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
      created_by: user.id,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await table("coupons", driver).insert(coupon);
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "create",
      resource: "coupon",
      resourceId: coupon.id,
      ip,
      metadata: { code: coupon.code, type: coupon.type, value: coupon.value },
    });
    return Response.json({ success: true, data: { coupon } });
  },
});
