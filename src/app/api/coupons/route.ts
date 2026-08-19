import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { Coupon } from "@/lib/types";

/** GET /api/coupons — daftar kupon aktif yang berlaku saat ini (publik). */
export const GET = api({
  methods: ["GET"],
  handler: async () => {
    const now = new Date().toISOString();
    const rows = await table<Coupon>("coupons", getDriver()).find({ active: true });
    const valid = rows.filter(
      (c) => (!c.starts_at || c.starts_at <= now) && (!c.expires_at || c.expires_at >= now),
    );
    return Response.json({
      success: true,
      data: {
        coupons: valid.map((c) => ({
          id: c.id,
          code: c.code,
          type: c.type,
          value: c.value,
          min_order: c.min_order,
          expires_at: c.expires_at,
          applicable_tiers: c.applicable_tiers,
        })),
      },
    });
  },
});
