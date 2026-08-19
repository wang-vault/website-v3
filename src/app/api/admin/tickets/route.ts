import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { Ticket } from "@/lib/types";

export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "tickets.view",
  handler: async ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "";
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    const rows = await table<Ticket>("tickets", getDriver()).find(where, {
      orderBy: [{ column: "updated_at", dir: "desc" }],
      limit: 200,
    });
    return Response.json({ success: true, data: { tickets: rows } });
  },
});
