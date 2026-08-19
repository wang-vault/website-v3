import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { CouponUsage, Order, OrderItem } from "@/lib/types";

/** GET /api/admin/analytics — analitik dari data nyata (tidak ada angka palsu). */
export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "analytics.view",
  handler: async () => {
    const driver = getDriver();
    const orders = await table<Order>("orders", driver).all({ orderBy: [{ column: "created_at", dir: "asc" }] });
    const items = await table<OrderItem>("order_items", driver).all();
    const usages = await table<CouponUsage>("coupon_usages", driver).all();

    const paid = orders.filter((o) => ["paid", "processing", "completed"].includes(String(o.status)));
    const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

    // Revenue per hari (30 hari terakhir)
    const revenueByDay: Record<string, number> = {};
    for (const o of paid) {
      const day = String(o.created_at).slice(0, 10);
      if (day >= monthAgo.slice(0, 10)) {
        revenueByDay[day] = (revenueByDay[day] ?? 0) + Number(o.total);
      }
    }

    // Paket populer
    const packageCount = new Map<string, { name: string; count: number }>();
    for (const it of items) {
      const key = String(it.package_name || it.product_name);
      const cur = packageCount.get(key) ?? { name: key, count: 0 };
      cur.count += 1;
      packageCount.set(key, cur);
    }

    // Penggunaan kupon
    const couponUse = new Map<string, { code: string; count: number; totalDiscount: number }>();
    for (const u of usages) {
      const cur = couponUse.get(String(u.coupon_id)) ?? { code: String(u.code), count: 0, totalDiscount: 0 };
      cur.count += 1;
      cur.totalDiscount += Number(u.discount);
      couponUse.set(String(u.coupon_id), cur);
    }

    const statusCounts = new Map<string, number>();
    for (const o of orders) {
      statusCounts.set(String(o.status), (statusCounts.get(String(o.status)) ?? 0) + 1);
    }

    return Response.json({
      success: true,
      data: {
        revenueByDay: Object.entries(revenueByDay)
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([date, revenue]) => ({ date, revenue })),
        popularPackages: [...packageCount.values()].sort((a, b) => b.count - a.count).slice(0, 10),
        couponUsage: [...couponUse.values()].sort((a, b) => b.count - a.count),
        orderStatusCounts: Object.fromEntries(statusCounts),
        summary: {
          totalOrders: orders.length,
          totalRevenue: paid.reduce((acc, o) => acc + Number(o.total), 0),
          totalDiscount: usages.reduce((acc, u) => acc + Number(u.discount), 0),
        },
      },
    });
  },
});
