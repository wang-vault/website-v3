import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { newId, nowIso } from "@/lib/utils";
import type { SqlDriver } from "@/lib/db/types";
import type { Coupon, CouponUsage } from "@/lib/types";
import { ApiError } from "@/lib/security";

export interface CouponValidation {
  coupon: Coupon;
  discount: number;
}

/**
 * Validasi kupon SERVER-SIDE.
 * Client tidak pernah menentukan nilai diskon.
 */
export async function validateCoupon(input: {
  code: string;
  price: number;
  tierSlug: string;
  userId?: string | null;
}): Promise<CouponValidation> {
  const code = input.code.trim().toUpperCase();
  const coupon = await table<Coupon>("coupons", getDriver()).findOne({ code });
  if (!coupon) {
    throw new ApiError("Kupon tidak ditemukan.", "COUPON_NOT_FOUND", 400);
  }
  if (!coupon.active) {
    throw new ApiError("Kupon sudah tidak aktif.", "COUPON_INACTIVE", 400);
  }
  const now = Date.now();
  if (coupon.starts_at && new Date(String(coupon.starts_at)).getTime() > now) {
    throw new ApiError("Kupon belum berlaku.", "COUPON_NOT_STARTED", 400);
  }
  if (coupon.expires_at && new Date(String(coupon.expires_at)).getTime() < now) {
    throw new ApiError("Kupon sudah kedaluwarsa.", "COUPON_EXPIRED", 400);
  }
  if (input.price < coupon.min_order) {
    throw new ApiError(
      `Kupon berlaku untuk pesanan minimal Rp${coupon.min_order.toLocaleString("id-ID")}.`,
      "COUPON_MIN_ORDER",
      400,
    );
  }
  // Tier applicability
  const tiers = coupon.applicable_tiers as string[] | null;
  if (tiers && tiers.length > 0 && !tiers.includes(input.tierSlug)) {
    throw new ApiError("Kupon tidak berlaku untuk tier ini.", "COUPON_TIER_NOT_APPLICABLE", 400);
  }

  const usages = table<CouponUsage>("coupon_usages", getDriver());

  // Batas pemakaian total
  if (coupon.max_usage !== null && coupon.max_usage !== undefined) {
    const total = await usages.count({ coupon_id: coupon.id });
    if (total >= coupon.max_usage) {
      throw new ApiError("Kupon sudah mencapai batas pemakaian.", "COUPON_LIMIT_REACHED", 400);
    }
  }
  // Batas per pelanggan
  if (input.userId && coupon.usage_per_customer !== null && coupon.usage_per_customer !== undefined) {
    const perCustomer = await usages.count({ coupon_id: coupon.id, user_id: input.userId });
    if (perCustomer >= coupon.usage_per_customer) {
      throw new ApiError("Kupon sudah digunakan pada akun ini.", "COUPON_LIMIT_REACHED", 400);
    }
  }

  let discount: number;
  if (coupon.type === "percentage") {
    discount = Math.round((input.price * Math.min(100, Math.max(0, coupon.value))) / 100);
  } else {
    discount = Math.min(input.price, Math.max(0, coupon.value));
  }
  return { coupon, discount };
}

/** Catat pemakaian kupon (dalam transaction order). */
export async function recordCouponUsage(
  input: {
    couponId: string;
    orderId: string;
    userId: string | null;
    code: string;
    discount: number;
  },
  driver: SqlDriver = getDriver(),
): Promise<void> {
  await table("coupon_usages", driver).insert({
    id: newId(),
    coupon_id: input.couponId,
    order_id: input.orderId,
    user_id: input.userId,
    code: input.code,
    discount: input.discount,
    created_at: nowIso(),
  });
}
