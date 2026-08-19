import { api, fromZodError } from "@/lib/api/helpers";
import { paginationQuerySchema } from "@/lib/validation";
import { listAuditLogs } from "@/lib/audit";

/** GET /api/admin/audit-logs?action=&resource=&q=&page= — audit log (hanya role berizin). */
export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "audit.view",
  handler: async ({ request }) => {
    const url = new URL(request.url);
    const parsed = paginationQuerySchema.safeParse({
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("pageSize"),
    });
    if (!parsed.success) throw fromZodError(parsed.error);
    const { page, pageSize } = parsed.data;
    const result = await listAuditLogs({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      action: url.searchParams.get("action") ?? undefined,
      resource: url.searchParams.get("resource") ?? undefined,
      actorEmail: url.searchParams.get("q") ?? undefined,
    });
    return Response.json({
      success: true,
      data: { logs: result.rows, total: result.total, page, pageSize },
    });
  },
});
