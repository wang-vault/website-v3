import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { refreshServiceStatuses } from "@/lib/services/lifecycle";
import type { Order, ServiceInstance } from "@/lib/types";

/** GET /api/admin/overview — ringkasan admin (angka nyata dari database). */
export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "dashboard.view",
  handler: async () => {
    await refreshServiceStatuses();
    const driver = getDriver();
    const orders = table<Order>("orders", driver);
    const services = table<ServiceInstance>("service_instances", driver);
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay);
    startOfMonth.setUTCDate(1);
    const dayIso = startOfDay.toISOString();
    const monthIso = startOfMonth.toISOString();

    const [totalOrders, todayOrders, monthOrders, pendingOrders, totalCustomers, activeServices, expiringSoon] =
      await Promise.all([
        orders.count(),
        orders.count({ created_at: { op: "gte", value: dayIso } }),
        orders.count({ created_at: { op: "gte", value: monthIso } }),
        orders.count({ status: { op: "in", value: ["pending", "awaiting_payment"] } }),
        table("users", driver).count({ status: "active" }),
        services.count({ status: { op: "in", value: ["active", "scheduled"] } }),
        services.count({ status: "active", expires_at: { op: "lte", value: new Date(Date.now() + 7 * 86_400_000).toISOString() } }),
      ]);

    const paidStatuses = ["paid", "processing", "completed"];
    const revenue = await orders.sum("total", { status: { op: "in", value: paidStatuses } });
    const monthRevenue = await orders.sum("total", { status: { op: "in", value: paidStatuses }, created_at: { op: "gte", value: monthIso } });
    const todayRevenue = await orders.sum("total", { status: { op: "in", value: paidStatuses }, created_at: { op: "gte", value: dayIso } });

    return Response.json({
      success: true,
      data: {
        stats: {
          totalOrders,
          todayOrders,
          monthOrders,
          pendingOrders,
          totalCustomers,
          activeServices,
          expiringSoon,
          revenue,
          monthRevenue,
          todayRevenue,
        },
        currency: "IDR",
      },
    });
  },
});
