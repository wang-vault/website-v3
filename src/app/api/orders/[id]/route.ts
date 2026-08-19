import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { getOrderById, getOrderItems } from "@/lib/store/orders";
import type { ServiceInstance } from "@/lib/types";

/**
 * GET /api/orders/[id] — detail pesanan (publik via UUID, noindex).
 * Pelanggan lain tidak dapat melihat data ini tanpa ID pesanan.
 */
export const GET = api({
  methods: ["GET"],
  handler: async ({ params, user }) => {
    const order = await getOrderById(params.id);
    if (!order) {
      return Response.json({ success: false, error: { code: "ORDER_NOT_FOUND", message: "Pesanan tidak ditemukan." } }, { status: 404 });
    }
    // Hanya pemilik akun atau staf yang boleh melihat detail penuh milik orang lain.
    if (order.user_id && order.user_id !== user?.id && !(user && ["owner", "admin", "staff"].includes(user.roleSlug))) {
      return Response.json({ success: false, error: { code: "FORBIDDEN", message: "Akses ditolak." } }, { status: 403 });
    }
    const [items, services] = await Promise.all([
      getOrderItems(order.id),
      table<ServiceInstance>("service_instances", getDriver()).find({ order_id: order.id }),
    ]);
    return Response.json({
      success: true,
      data: { order, items, services },
    });
  },
});
