import { api, fromZodError } from "@/lib/api/helpers";
import { forgotPasswordSchema } from "@/lib/validation";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { createAuthToken } from "@/lib/auth/tokens";
import { sendMail, resetPasswordEmailHtml, appUrl, smtpConfigured } from "@/lib/mail";
import { getSettings } from "@/lib/settings";
import { ApiError } from "@/lib/security";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import type { User } from "@/lib/types";

export const POST = api({
  methods: ["POST"],
  rateLimit: { limit: RATE_LIMITS.resetPassword },
  skipMaintenance: true,
  handler: async ({ request, ip }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError("JSON tidak valid.", "INVALID_JSON", 400);
    }
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const user = await table<User>("users", getDriver()).findOne({ email: parsed.data.email });
    // Selalu respons sama (tidak membocorkan keberadaan email).
    if (!user || user.status !== "active") {
      return Response.json({
        success: true,
        data: { message: "Jika email terdaftar, tautan reset kata sandi telah dikirim." },
      });
    }
    const token = await createAuthToken(user.id, "reset_password");
    const url = `${appUrl()}/reset-password/${token}`;
    const settings = await getSettings();
    await auditLog({ actorType: "user", actorId: user.id, actorEmail: user.email, action: "forgot_password", resource: "auth", ip });

    if (!smtpConfigured()) {
      const devLink = process.env.NODE_ENV !== "production" ? url : null;
      return Response.json({
        success: true,
        data: { message: "SMTP belum dikonfigurasi — email reset tidak terkirim.", devLink, emailSent: false },
      });
    }
    const mail = await sendMail({ to: user.email, subject: "Atur Ulang Kata Sandi — WangStore", ...resetPasswordEmailHtml(url, settings.siteName) });
    return Response.json({
      success: true,
      data: { message: mail.ok ? "Tautan reset telah dikirim." : "Gagal mengirim email.", emailSent: mail.ok },
    });
  },
});
