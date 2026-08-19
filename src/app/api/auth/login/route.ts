import { api, fromZodError } from "@/lib/api/helpers";
import { loginSchema } from "@/lib/validation";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { verifyPassword, DUMMY_HASH } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { ApiError } from "@/lib/security";
import { nowIso } from "@/lib/utils";
import type { Profile, User } from "@/lib/types";

export const POST = api({
  methods: ["POST"],
  rateLimit: { limit: RATE_LIMITS.login },
  skipMaintenance: true,
  handler: async ({ request, ip }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError("JSON tidak valid.", "INVALID_JSON", 400);
    }
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const user = await table<User>("users", getDriver()).findOne({ email: parsed.data.email });
    // Timing-resistant: selalu bandingkan hash, walau email tidak dikenal.
    const valid = user
      ? await verifyPassword(parsed.data.password, user.password_hash)
      : await verifyPassword(parsed.data.password, DUMMY_HASH);

    if (!user || !valid || user.status !== "active") {
      await auditLog({
        actorType: "system",
        action: "login.failed",
        resource: "auth",
        ip,
        metadata: { email: user ? "known" : "unknown" },
      });
      throw new ApiError("Email atau kata sandi salah.", "INVALID_CREDENTIALS", 401);
    }

    const now = nowIso();
    await table<User>("users", getDriver()).update(user.id, { last_login_at: now, last_login_ip: ip, updated_at: now });

    const session = await createSession({
      userId: user.id,
      ip,
      userAgent: request.headers.get("user-agent"),
    });
    setSessionCookie(session.token, session.expiresAt);
    // Token sesi dikembalikan hanya di luar production (untuk test/development CLI).
    const sessionToken = process.env.NODE_ENV !== "production" ? session.token : undefined;

    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "login",
      resource: "auth",
      ip,
    });

    const profile = await table<Profile>("profiles", getDriver()).findOne({ user_id: user.id });
    const role = await table("roles", getDriver()).findById(user.role_id);
    const roleSlug = String(role?.slug ?? "customer");
    return Response.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: profile?.full_name ?? "",
          emailVerified: !!user.email_verified_at,
          roleSlug,
          isStaff: ["owner", "admin", "staff"].includes(roleSlug),
        },
        sessionToken,
      },
    });
  },
});
