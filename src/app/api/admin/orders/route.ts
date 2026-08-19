import { api, fromZodError } from "@/lib/api/helpers";
import { paginationQuerySchema } from "@/lib/validation";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { Order } from "@/lib/types";

/** GET /api/admin/orders?status=&q=&page= — daftar pesanan (paginasi). */
export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "orders.view",
  handler: async ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "";
    const q = (url.searchParams.get("q") ?? "").trim();
    const parsed = paginationQuerySchema.safeParse({
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("pageSize"),
    });
    if (!parsed.success) throw fromZodError(parsed.error);
    const { page, pageSize } = parsed.data;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const driver = getDriver();
    const orders = table<Order>("orders", driver);
    let rows = await orders.find(where, { orderBy: [{ column: "created_at", dir: "desc" }], limit: 500 });
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter(
        (o) =>
          o.order_number.toLowerCase().includes(needle) ||
          o.customer_name.toLowerCase().includes(needle) ||
          o.customer_email.toLowerCase().includes(needle) ||
          o.customer_whatsapp.includes(needle),
      );
    }
    const total = rows.length;
    const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
    return Response.json({ success: true, data: { orders: pageRows, total, page, pageSize } });
  },
});
