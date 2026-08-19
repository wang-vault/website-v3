import { api, fromZodError } from "@/lib/api/helpers";
import { resetPasswordSchema } from "@/lib/validation";
import { consumeAuthToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/password";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { auditLog } from "@/lib/audit";
import { nowIso } from "@/lib/utils";
import { ApiError } from "@/lib/security";

export const POST = api({
  methods: ["POST"],
  rateLimit: { limit: 10 },
  skipMaintenance: true,
  handler: async ({ request, ip }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError("JSON tidak valid.", "INVALID_JSON", 400);
    }
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const verified = await consumeAuthToken(parsed.data.token, "reset_password");
    const passwordHash = await hashPassword(parsed.data.password);
    await table("users", getDriver()).update(verified.userId, {
      password_hash: passwordHash,
      updated_at: nowIso(),
    });
    await auditLog({ actorType: "user", actorId: verified.userId, action: "reset_password", resource: "user", resourceId: verified.userId, ip });
    return Response.json({ success: true, data: { message: "Kata sandi berhasil diubah. Silakan masuk." } });
  },
});
