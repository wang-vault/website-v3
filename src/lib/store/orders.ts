import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { newId, nowIso, shortCode } from "@/lib/utils";
import type { Order, OrderItem } from "@/lib/types";
import { ApiError } from "@/lib/security";
import { auditLog } from "@/lib/audit";
import { calculateOrderPrice, normalizeLowConfig } from "@/lib/pricing";
import { getLowRuleSet, getServerPackageById, getTierBySlug, getVpsPackageById } from "@/lib/store/catalog";
import { recordCouponUsage, validateCoupon } from "@/lib/store/coupons";
import { buildOrderWhatsAppMessage, waMeUrl } from "@/lib/whatsapp";
import { getSettings } from "@/lib/settings";

export interface CreateOrderInput {
  tierSlug: "low" | "medium" | "high" | "vps";
  cpu?: number;
  ram?: number;
  storage?: number;
  packageId?: string | null;
  vpsPackageId?: string | null;
  customerName: string;
  customerWhatsapp: string;
  customerEmail: string;
  serverName: string;
  notes?: string;
  couponCode?: string | null;
  userId?: string | null;
  ip?: string | null;
}

export interface CreateOrderResult {
  order: Order;
  whatsappUrl: string | null;
}

/**
 * CREATE ORDER — alur server-side yang ketat:
 * validasi tier → reject ongoing → verifikasi paket → verifikasi kupon →
 * hitung harga SERVER-SIDE → transaction (order + item + coupon usage + audit) →
 * WhatsApp URL.
 * Harga dari client DIABAIKAN sepenuhnya.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const driver = getDriver();
  const settings = await getSettings();
  const tier = await getTierBySlug(input.tierSlug === "vps" ? "high" : input.tierSlug);
  if (!tier || !tier.orderable || tier.status !== "active") {
    throw new ApiError("Tier tidak dikenali atau tidak dapat dipesan.", "TIER_INVALID", 422);
  }

  // 1. Reject ongoing: user authenticated dengan pesanan aktif yang sama
  if (input.userId) {
    const ongoing = await table<Order>("orders", getDriver()).findOne({
      user_id: input.userId,
      status: { op: "in", value: ["pending", "awaiting_payment"] },
      tier_slug: input.tierSlug,
      package_id: input.packageId ?? null,
      cpu: input.cpu ?? 0,
      ram: input.ram ?? 0,
      storage: input.storage ?? 0,
    });
    if (ongoing) {
      throw new ApiError(
        "Anda masih memiliki pesanan aktif dengan konfigurasi yang sama.",
        "ONGOING_ORDER",
        409,
      );
    }
  }

  let lowRules = null;
  let serverPackage = null;
  let vpsPackage = null;
  let normalized = null;

  if (input.tierSlug === "low") {
    lowRules = await getLowRuleSet();
    if (!lowRules) throw new ApiError("Aturan harga belum dikonfigurasi.", "PRICING_NOT_CONFIGURED", 500);
    normalized = normalizeLowConfig({ cpu: input.cpu, ram: input.ram, storage: input.storage }, lowRules);
  } else if (input.tierSlug === "medium" || input.tierSlug === "high") {
    if (!input.packageId) throw new ApiError("Paket wajib dipilih.", "PACKAGE_REQUIRED", 422);
    serverPackage = await getServerPackageById(input.packageId);
    if (!serverPackage || serverPackage.tier_id !== tier.id) {
      throw new ApiError("Paket tidak ditemukan.", "PACKAGE_NOT_FOUND", 422);
    }
    if (serverPackage.status !== "available" || !serverPackage.orderable || serverPackage.archived_at) {
      throw new ApiError("Paket sedang tidak dapat dipesan.", "PACKAGE_NOT_ORDERABLE", 409);
    }
  } else if (input.tierSlug === "vps") {
    if (!input.vpsPackageId) throw new ApiError("Paket VPS wajib dipilih.", "PACKAGE_REQUIRED", 422);
    vpsPackage = await getVpsPackageById(input.vpsPackageId);
    if (!vpsPackage || vpsPackage.status !== "available" || !vpsPackage.visible || vpsPackage.archived_at) {
      throw new ApiError("Paket VPS tidak ditemukan.", "PACKAGE_NOT_FOUND", 422);
    }
  }

  // Hitung harga SERVER-SIDE (ignore harga client)
  const pricing = calculateOrderPrice({
    tierSlug: input.tierSlug === "vps" ? "vps" : input.tierSlug,
    config: { cpu: input.cpu ?? 0, ram: input.ram ?? 0, storage: input.storage ?? 0 },
    rules: lowRules ?? undefined,
    serverPackage,
    vpsPackage,
  });
  if (!pricing) {
    throw new ApiError("Tier tidak dikenali.", "TIER_INVALID", 422);
  }

  // Kupon
  let discount = 0;
  let couponId: string | null = null;
  const couponCode: string | null = input.couponCode?.trim().toUpperCase() || null;
  if (couponCode) {
    const validation = await validateCoupon({
      code: couponCode,
      price: pricing.priceRaw,
      tierSlug: input.tierSlug,
      userId: input.userId,
    });
    discount = validation.discount;
    couponId = validation.coupon.id;
  }
  const total = Math.max(0, pricing.priceRaw - discount);

  // Buat order dalam transaction
  const orderNumber = await generateOrderNumber(driver);
  const now = nowIso();
  const orderId = newId();

  const orderRow: Order = {
    id: orderId,
    order_number: orderNumber,
    user_id: input.userId ?? null,
    customer_name: input.customerName,
    customer_whatsapp: input.customerWhatsapp,
    customer_email: input.customerEmail,
    server_name: input.serverName,
    notes: input.notes ?? "",
    tier_slug: input.tierSlug === "vps" ? "high" : (input.tierSlug as "low" | "medium" | "high"),
    tier_name: input.tierSlug === "vps" ? "VPS" : tier.name,
    package_id: serverPackage?.id ?? vpsPackage?.id ?? null,
    package_name: serverPackage?.name ?? vpsPackage?.name ?? null,
    cpu: input.tierSlug === "low" && normalized ? normalized.cpu : (serverPackage?.cpu ?? vpsPackage?.cpu ?? input.cpu ?? 0),
    ram: input.tierSlug === "low" && normalized ? normalized.ram : (serverPackage?.ram ?? vpsPackage?.ram ?? input.ram ?? 0),
    storage:
      input.tierSlug === "low" && normalized
        ? normalized.storage
        : (serverPackage?.storage ?? vpsPackage?.storage ?? input.storage ?? 0),
    price_raw: pricing.priceRaw,
    discount,
    total,
    coupon_code: couponCode,
    status: "awaiting_payment",
    payment_provider: "manual",
    currency: "IDR",
    whatsapp_number: settings.whatsappNumber,
    source: "web",
    created_at: now,
    updated_at: now,
    confirmed_at: null,
    cancelled_at: null,
  };

  const itemRow: OrderItem = {
    id: newId(),
    order_id: orderId,
    product_id: serverPackage?.id ?? vpsPackage?.id ?? null,
    product_type: input.tierSlug === "vps" ? "vps" : "server_builder",
    product_name: input.tierSlug === "vps" ? (vpsPackage?.name ?? "Paket VPS") : `${tier.name}${serverPackage ? ` — ${serverPackage.name}` : " — Custom"}`,
    tier_slug: input.tierSlug === "vps" ? null : input.tierSlug,
    package_id: serverPackage?.id ?? vpsPackage?.id ?? null,
    package_name: serverPackage?.name ?? vpsPackage?.name ?? null,
    cpu: orderRow.cpu,
    ram: orderRow.ram,
    storage: orderRow.storage,
    unit_price: pricing.priceRaw,
    quantity: 1,
    total_price: total,
    metadata: {
      performance_factor: serverPackage?.performance_factor ?? tier.performance_factor,
      estimate: pricing.breakdown ? { breakdown: pricing.breakdown } : undefined,
    },
  };

  try {
    await driver.tx(async (tx) => {
      const orders = table<Order>("orders", tx);
      await orders.insert(orderRow);
      await table<OrderItem>("order_items", tx).insert(itemRow);
      if (couponId && couponCode) {
        await recordCouponUsage(
          {
            couponId,
            orderId,
            userId: input.userId ?? null,
            code: couponCode,
            discount,
          },
          tx,
        );
      }
    });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("Gagal membuat pesanan. Silakan coba lagi.", "ORDER_CREATE_FAILED", 500);
  }

  await auditLog({
    actorType: input.userId ? "user" : "system",
    actorId: input.userId ?? null,
    action: "create",
    resource: "order",
    resourceId: orderId,
    ip: input.ip ?? null,
    metadata: { orderNumber, tier: input.tierSlug, total },
  });

  // WhatsApp URL
  const waNumber = settings.whatsappNumber;
  const whatsappUrl = waNumber
    ? waMeUrl(waNumber, buildOrderWhatsAppMessage(orderRow))
    : null;

  return { order: orderRow, whatsappUrl };
}

async function generateOrderNumber(driver: ReturnType<typeof getDriver>): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = shortCode("WS", 8);
    const exists = await table("orders", driver).findOne({ order_number: candidate });
    if (!exists) return candidate;
  }
  throw new ApiError("Gagal membuat nomor pesanan.", "ORDER_NUMBER_FAILED", 500);
}

export async function getOrderById(id: string): Promise<Order | null> {
  return table<Order>("orders", getDriver()).findById(id);
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  return table<OrderItem>("order_items", getDriver()).find({ order_id: orderId });
}

export const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["paid", "cancelled", "expired", "pending"],
  paid: ["processing", "refunded", "cancelled"],
  processing: ["completed", "cancelled", "refunded"],
  completed: ["refunded", "cancelled"],
  cancelled: [],
  expired: ["pending"],
  refunded: [],
};

export function canTransition(from: string, to: string): boolean {
  return (ORDER_STATUS_TRANSITIONS[from] ?? []).includes(to);
}
