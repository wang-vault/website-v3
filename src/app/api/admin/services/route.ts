import { api, fromZodError } from "@/lib/api/helpers";
import { paginationQuerySchema } from "@/lib/validation";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { refreshServiceStatuses } from "@/lib/services/lifecycle";
import type { ServiceInstance } from "@/lib/types";

/** GET /api/admin/services?status=&q= — daftar layanan semua pelanggan. */
export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "services.view",
  handler: async ({ request }) => {
    await refreshServiceStatuses();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "";
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const parsed = paginationQuerySchema.safeParse({
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("pageSize"),
    });
    if (!parsed.success) throw fromZodError(parsed.error);
    const { page, pageSize } = parsed.data;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    const driver = getDriver();
    const services = table<ServiceInstance>("service_instances", driver);
    let rows = await services.find(where, { orderBy: [{ column: "created_at", dir: "desc" }], limit: 500 });
    if (q) {
      rows = rows.filter(
        (s) =>
          s.service_number.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          String(s.customer_id).toLowerCase().includes(q),
      );
    }
    const total = rows.length;
    const userIds = [...new Set(rows.map((r) => String(r.customer_id)))];
    const users = userIds.length
      ? await table("users", driver).find({ id: { op: "in", value: userIds } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    return Response.json({
      success: true,
      data: {
        services: rows.slice((page - 1) * pageSize, page * pageSize).map((s) => ({
          ...s,
          customerEmail: userMap.get(String(s.customer_id))?.email ?? null,
        })),
        total,
        page,
        pageSize,
      },
    });
  },
});
