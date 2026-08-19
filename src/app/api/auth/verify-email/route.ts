import { api, fromZodError } from "@/lib/api/helpers";
import { z } from "zod";
import { consumeAuthToken } from "@/lib/auth/tokens";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { auditLog } from "@/lib/audit";
import { nowIso } from "@/lib/utils";

const schema = z.object({ token: z.string().min(1) });

export const POST = api({
  methods: ["POST"],
  rateLimit: { limit: 10 },
  skipMaintenance: true,
  handler: async ({ request, ip }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new Error("invalid json");
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const verified = await consumeAuthToken(parsed.data.token, "verify_email");
    await table("users", getDriver()).update(verified.userId, {
      email_verified_at: nowIso(),
      updated_at: nowIso(),
    });
    await auditLog({
      actorType: "user",
      actorId: verified.userId,
      action: "verify_email",
      resource: "user",
      resourceId: verified.userId,
      ip,
    });
    return Response.json({ success: true, data: { message: "Email berhasil diverifikasi. Silakan masuk." } });
  },
});
