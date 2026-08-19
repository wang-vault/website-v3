import { api, fromZodError, requireUser } from "@/lib/api/helpers";
import { changePasswordSchema } from "@/lib/validation";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { auditLog } from "@/lib/audit";
import { nowIso } from "@/lib/utils";
import { ApiError } from "@/lib/security";
import type { User } from "@/lib/types";

export const POST = api({
  methods: ["POST"],
  auth: "required",
  handler: async ({ request, user, ip }) => {
    void requireUser;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError("JSON tidak valid.", "INVALID_JSON", 400);
    }
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const row = await table<User>("users", getDriver()).findById(user.id);
    if (!row) throw new ApiError("Akun tidak ditemukan.", "NOT_FOUND", 404);
    const okPass = await verifyPassword(parsed.data.currentPassword, row.password_hash);
    if (!okPass) throw new ApiError("Kata sandi saat ini salah.", "WRONG_PASSWORD", 400);

    await table("users", getDriver()).update(user.id, { password_hash: await hashPassword(parsed.data.newPassword), updated_at: nowIso() });
    await auditLog({ actorType: "user", actorId: user.id, actorEmail: user.email, action: "change_password", resource: "user", resourceId: user.id, ip });
    return Response.json({ success: true, data: { message: "Kata sandi berhasil diubah." } });
  },
});
