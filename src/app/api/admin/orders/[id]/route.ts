import { api, fromZodError } from "@/lib/api/helpers";
import { orderStatusSchema } from "@/lib/validation/admin";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { canTransition, getOrderById, getOrderItems } from "@/lib/store/orders";
import { createServiceForOrder, confirmRenewalOrder } from "@/lib/store/services";
import { auditLog } from "@/lib/audit";
import { nowIso } from "@/lib/utils";
import { ApiError } from "@/lib/security";
import type { Order, ServiceInstance } from "@/lib/types";

export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "orders.view",
  handler: async ({ params }) => {
    const driver = getDriver();
    const [order, items, services, renewals] = await Promise.all([
      getOrderById(params.id),
      getOrderItems(params.id),
      table<ServiceInstance>("service_instances", driver).find({ order_id: params.id }),
      table("service_renewals", driver).find({ order_id: params.id }),
    ]);
    if (!order) throw new ApiError("Pesanan tidak ditemukan.", "NOT_FOUND", 404);
    return Response.json({ success: true, data: { order, items, services, renewals } });
  },
});

/**
 * PATCH /api/admin/orders/[id] — ubah status pesanan (validasi transisi).
 * Konfirmasi pembayaran (→ paid) membuat service instance secara atomik.
 */
export const PATCH = api({
  methods: ["PATCH"],
  auth: "admin",
  permission: "orders.update",
  handler: async ({ request, params, user, ip }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = orderStatusSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const driver = getDriver();
    const order = await getOrderById(params.id);
    if (!order) throw new ApiError("Pesanan tidak ditemukan.", "NOT_FOUND", 404);

    const target = parsed.data.status;
    if (order.status === target) {
      return Response.json({ success: true, data: { order, message: "Status sudah sama." } });
    }
    if (!canTransition(order.status, target)) {
      throw new ApiError(
        `Transisi status tidak diizinkan: ${order.status} → ${target}.`,
        "INVALID_TRANSITION",
        409,
      );
    }

    const now = nowIso();
    const patch: Record<string, unknown> = { status: target, updated_at: now };
    if (target === "cancelled" || target === "refunded") patch.cancelled_at = now;
    if (target === "paid") patch.confirmed_at = now;

    const updated = await table<Order>("orders", driver).update(order.id, patch);

    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "order.status_change",
      resource: "order",
      resourceId: order.id,
      ip,
      metadata: { from: order.status, to: target, reason: parsed.data.reason ?? "" },
    });

    // Konfirmasi pembayaran → buat layanan (jika pesanan punya akun).
    let serviceCreated: ServiceInstance | null = null;
    if (target === "paid") {
      const items = await getOrderItems(order.id);
      const item = items[0];
      if (item && order.user_id) {
        serviceCreated = await createServiceForOrder(
          { ...order, status: target, confirmed_at: now },
          item,
          {
            activationAt: parsed.data.activationAt ?? now,
            durationDays: parsed.data.durationDays ?? 30,
            renewable: parsed.data.renewable ?? true,
          },
          { id: user.id, email: user.email },
        );
      }
    }

    // Konfirmasi pembayaran renewal → perpanjang masa layanan.
    let renewalConfirmed = false;
    if (target === "paid" && order.source === "renewal") {
      const result = await confirmRenewalOrder(
        { ...order, status: target, confirmed_at: now },
        { id: user.id, email: user.email },
      );
      renewalConfirmed = !!result;
    }

    return Response.json({
      success: true,
      data: { order: updated, serviceCreated: !!serviceCreated, renewalConfirmed },
    });
  },
});
