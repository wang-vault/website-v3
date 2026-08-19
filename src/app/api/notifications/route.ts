import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { NotificationRow } from "@/lib/types";

export const GET = api({
  methods: ["GET"],
  auth: "required",
  handler: async ({ user }) => {
    const [rows, unread] = await Promise.all([
      table<NotificationRow>("notifications", getDriver()).find({ user_id: user.id }, { orderBy: [{ column: "created_at", dir: "desc" }], limit: 50 }),
      table<NotificationRow>("notifications", getDriver()).count({ user_id: user.id, read_at: { op: "isNull", value: true } }),
    ]);
    return Response.json({ success: true, data: { notifications: rows, unread } });
  },
});
