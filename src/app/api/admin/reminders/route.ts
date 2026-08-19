import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { runDueReminders } from "@/lib/services/reminders";
import { getSettings } from "@/lib/settings";
import { auditLog } from "@/lib/audit";
import { smtpConfigured } from "@/lib/mail";
import type { ServiceReminder } from "@/lib/types";

export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "services.reminders",
  handler: async () => {
    const driver = getDriver();
    const settings = await getSettings();
    const [scheduled, sent, failed] = await Promise.all([
      table<ServiceReminder>("service_reminders", driver).count({ status: "scheduled" }),
      table<ServiceReminder>("service_reminders", driver).count({ status: "sent" }),
      table<ServiceReminder>("service_reminders", driver).count({ status: "failed" }),
    ]);
    return Response.json({
      success: true,
      data: {
        enabled: settings.remindersEnabled,
        intervals: settings.reminderIntervals,
        counts: { scheduled, sent, failed },
        channels: {
          dashboard: true,
          email: smtpConfigured(),
          whatsapp: false, // integrasi WhatsApp terkirim belum tersedia — jujur.
        },
        schedulerNote:
          "Reminder dijalankan oleh cron serverless (Vercel Cron → /api/cron/reminders). Selama cron belum diaktifkan, gunakan tombol 'Jalankan Sekarang'.",
      },
    });
  },
});

/** POST — jalankan reminder yang jatuh tempo sekarang (idempotent). */
export const POST = api({
  methods: ["POST"],
  auth: "admin",
  permission: "services.reminders",
  handler: async ({ user, ip }) => {
    const result = await runDueReminders();
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "reminders.run",
      resource: "service_reminders",
      ip,
      metadata: result as unknown as Record<string, unknown>,
    });
    return Response.json({ success: true, data: result });
  },
});
