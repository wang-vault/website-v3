import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { nowIso } from "@/lib/utils";

export const POST = api({
  methods: ["POST"],
  auth: "required",
  handler: async ({ params, user }) => {
    await table("notifications", getDriver()).updateWhere(
      { id: params.id, user_id: user.id },
      { read_at: nowIso() },
    );
    return Response.json({ success: true, data: { message: "Ditandai sudah dibaca." } });
  },
});
