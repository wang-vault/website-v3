import { api, fromZodError } from "@/lib/api/helpers";
import { couponValidateSchema } from "@/lib/validation";
import { validateCoupon } from "@/lib/store/coupons";
import { ApiError } from "@/lib/security";
import { RATE_LIMITS } from "@/lib/rate-limit";

/** POST /api/coupons/validate — validasi kupon server-side (diskon dihitung server). */
export const POST = api({
  methods: ["POST"],
  rateLimit: { limit: RATE_LIMITS.couponValidate },
  handler: async ({ request, user }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError("JSON tidak valid.", "INVALID_JSON", 400);
    }
    const parsed = couponValidateSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const result = await validateCoupon({
      code: parsed.data.code,
      price: parsed.data.price,
      tierSlug: parsed.data.tierSlug,
      userId: user?.id ?? null,
    });
    return Response.json({
      success: true,
      data: {
        code: result.coupon.code,
        discount: result.discount,
        type: result.coupon.type,
        value: result.coupon.value,
        totalAfterDiscount: Math.max(0, parsed.data.price - result.discount),
      },
    });
  },
});
