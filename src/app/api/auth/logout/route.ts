import { api } from "@/lib/api/helpers";
import { clearSessionCookie, revokeSession } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/security";

export const POST = api({
  methods: ["POST"],
  skipCsrf: true,
  skipMaintenance: true,
  handler: async ({ user, ip }) => {
    const token = cookies().get(SESSION_COOKIE)?.value;
    if (token) await revokeSession(token);
    clearSessionCookie();
    if (user) {
      await auditLog({ actorType: "user", actorId: user.id, actorEmail: user.email, action: "logout", resource: "auth", ip });
    }
    return Response.json({ success: true, data: { message: "Berhasil keluar." } });
  },
});
