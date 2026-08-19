import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { Order } from "@/lib/types";

/** GET /api/account/orders — riwayat pesanan milik user yang login. */
export const GET = api({
  methods: ["GET"],
  auth: "required",
  handler: async ({ user }) => {
    const rows = await table<Order>("orders", getDriver()).find(
      { user_id: user.id },
      { orderBy: [{ column: "created_at", dir: "desc" }] },
    );
    return Response.json({ success: true, data: { orders: rows } });
  },
});
