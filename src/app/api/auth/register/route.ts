import { api, fromZodError } from "@/lib/api/helpers";
import { registerSchema } from "@/lib/validation";
import { registerUser } from "@/lib/store/users";
import { createAuthToken } from "@/lib/auth/tokens";
import { sendMail, verificationEmailHtml, appUrl, smtpConfigured } from "@/lib/mail";
import { getSettings } from "@/lib/settings";
import { ApiError } from "@/lib/security";
import { auditLog } from "@/lib/audit";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const POST = api({
  methods: ["POST"],
  rateLimit: { limit: RATE_LIMITS.register },
  skipMaintenance: true,
  handler: async ({ request, ip }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError("JSON tidak valid.", "INVALID_JSON", 400);
    }
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const user = await registerUser({
      email: parsed.data.email,
      password: parsed.data.password,
      fullName: parsed.data.fullName,
      whatsapp: parsed.data.whatsapp,
      ip,
    });

    // Kirim email verifikasi (jujur soal status SMTP).
    const token = await createAuthToken(user.id, "verify_email");
    const url = `${appUrl()}/verify-email/${token}`;
    const settings = await getSettings();
    let emailSent = false;
    let emailError: string | null = null;

    if (smtpConfigured()) {
      const mail = await sendMail({
        to: user.email,
        subject: "Verifikasi Email — WangStore",
        ...verificationEmailHtml(url, settings.siteName),
      });
      emailSent = mail.ok;
      emailError = mail.ok ? null : mail.error ?? "Gagal mengirim email.";
    } else {
      emailError = "SMTP belum dikonfigurasi — email verifikasi tidak terkirim.";
    }

    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "register",
      resource: "user",
      resourceId: user.id,
      ip,
      metadata: { emailSent, emailError },
    });

    // Development: tampilkan tautan verifikasi agar alur tetap dapat diuji.
    const devLink = !smtpConfigured() && process.env.NODE_ENV !== "production" ? url : null;

    return Response.json({
      success: true,
      data: {
        message: "Akun berhasil dibuat. Silakan verifikasi email Anda.",
        emailSent,
        emailError,
        devLink,
        verificationRequired: true,
      },
    });
  },
});
