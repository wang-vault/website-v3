import { api, fromZodError } from "@/lib/api/helpers";
import { z } from "zod";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { createAuthToken } from "@/lib/auth/tokens";
import { sendMail, verificationEmailHtml, appUrl, smtpConfigured } from "@/lib/mail";
import { getSettings } from "@/lib/settings";
import { ApiError } from "@/lib/security";
import { RATE_LIMITS } from "@/lib/rate-limit";
import type { User } from "@/lib/types";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

export const POST = api({
  methods: ["POST"],
  rateLimit: { limit: RATE_LIMITS.verifyEmail },
  skipMaintenance: true,
  handler: async ({ request }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError("JSON tidak valid.", "INVALID_JSON", 400);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const user = await table<User>("users", getDriver()).findOne({ email: parsed.data.email });
    if (!user || user.email_verified_at) {
      // Tidak membocorkan keberadaan email
      return Response.json({
        success: true,
        data: { message: "Jika email terdaftar dan belum diverifikasi, tautan verifikasi telah dikirim." },
      });
    }
    const token = await createAuthToken(user.id, "verify_email");
    const url = `${appUrl()}/verify-email/${token}`;
    const settings = await getSettings();
    if (!smtpConfigured()) {
      const devLink = process.env.NODE_ENV !== "production" ? url : null;
      return Response.json({
        success: true,
        data: { message: "SMTP belum dikonfigurasi.", devLink, emailSent: false },
      });
    }
    const mail = await sendMail({ to: user.email, subject: "Verifikasi Email — WangStore", ...verificationEmailHtml(url, settings.siteName) });
    return Response.json({
      success: true,
      data: { message: mail.ok ? "Tautan verifikasi telah dikirim." : "Gagal mengirim email.", emailSent: mail.ok },
    });
  },
});
