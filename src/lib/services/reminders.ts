import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { addDaysIso, newId, nowIso } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { sendMail, smtpConfigured } from "@/lib/mail";
import { formatDate } from "@/lib/utils/format";
import type { ReminderType, ServiceInstance, ServiceReminder } from "@/lib/types";

/**
 * REMINDER SYSTEM — serverless-compatible & idempotent.
 * - Satu reminder per (service_id, reminder_type) → unique constraint
 *   mencegah pengiriman ganda walau job dijalankan dua kali.
 * - Dijalankan lewat endpoint cron (Vercel Cron) /api/cron/reminders
 *   atau tombol admin "Jalankan Sekarang".
 * - Kanal: notifikasi dashboard selalu; email hanya jika SMTP dikonfigurasi;
 *   WhatsApp hanya jika integrasi dikonfigurasi (saat ini: belum, dan
 *   sistem TIDAK mengklaim mengirim WhatsApp).
 */

export function reminderTypeFor(daysLeft: number): ReminderType | null {
  if (daysLeft <= 0) return "expired";
  if (daysLeft <= 1) return "expiry_1d";
  if (daysLeft <= 3) return "expiry_3d";
  if (daysLeft <= 7) return "expiry_7d";
  return null;
}

export async function planRemindersForService(
  service: Pick<ServiceInstance, "id" | "customer_id" | "expires_at">,
  intervals: number[],
  now: Date = new Date(),
): Promise<number> {
  const driver = getDriver();
  const reminders = table<ServiceReminder>("service_reminders", driver);
  const expiresAt = new Date(service.expires_at);
  let created = 0;
  for (const interval of intervals) {
    const type = reminderTypeFor(
      Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000),
    );
    const scheduledAt =
      interval === 0
        ? expiresAt.toISOString()
        : addDaysIso(expiresAt, -interval);
    const reminderType: ReminderType = interval === 0 ? "expired" : (`expiry_${interval}d` as ReminderType);
    // Skip bila layanan sudah lewat dari interval ini
    if (new Date(scheduledAt).getTime() < now.getTime() - 60_000 && interval > 0) continue;
    void type;
    const exists = await reminders.findOne({
      service_id: service.id,
      reminder_type: reminderType,
    });
    if (!exists) {
      try {
        await reminders.insert({
          id: newId(),
          service_id: service.id,
          customer_id: service.customer_id,
          reminder_type: reminderType,
          scheduled_at: scheduledAt,
          sent_at: null,
          status: "scheduled",
          channel: "dashboard",
          created_at: nowIso(),
        });
        created++;
      } catch {
        // Unique constraint (service_id, reminder_type) — job idempotent.
      }
    }
  }
  return created;
}

export interface ReminderRunResult {
  processed: number;
  sent: number;
  emailSent: number;
  emailFailed: number;
  skipped: number;
}

/** Proses semua reminder yang jatuh tempo. Aman dipanggil berulang. */
export async function runDueReminders(now: Date = new Date()): Promise<ReminderRunResult> {
  const driver = getDriver();
  const settings = await getSettings();
  if (!settings.remindersEnabled) {
    return { processed: 0, sent: 0, emailSent: 0, emailFailed: 0, skipped: 0 };
  }
  const reminders = table<ServiceReminder>("service_reminders", driver);
  const due = await reminders.find({
    status: "scheduled",
    scheduled_at: { op: "lte", value: now.toISOString() },
  });
  const result: ReminderRunResult = { processed: 0, sent: 0, emailSent: 0, emailFailed: 0, skipped: 0 };
  const emailConfigured = smtpConfigured();

  for (const reminder of due) {
    result.processed++;
    // Idempotensi: klaim dengan status update hanya jika masih scheduled.
    const claimed = await reminders.updateWhere(
      { id: reminder.id, status: "scheduled" },
      { status: "sent", sent_at: now.toISOString() },
    );
    if (!claimed) {
      result.skipped++;
      continue; // sudah diproses job lain
    }

    const service = await table<ServiceInstance>("service_instances", driver).findById(
      String(reminder.service_id),
    );
    const customer = service
      ? await table("users", driver).findById(String(service.customer_id))
      : null;
    if (!service || !customer) {
      result.skipped++;
      continue;
    }

    // 1) Notifikasi dashboard (selalu).
    await table("notifications", driver).insert({
      id: newId(),
      user_id: customer.id,
      type: "service_reminder",
      title: reminderTitle(reminder.reminder_type, service.name),
      message: reminderMessage(reminder.reminder_type, service.expires_at),
      link: "/dashboard/services",
      read_at: null,
      created_at: nowIso(),
    });

    // 2) Email — hanya jika SMTP dikonfigurasi, dan jujur soal hasilnya.
    if (emailConfigured) {
      const mail = await sendMail({
        to: String(customer.email),
        subject: reminderTitle(reminder.reminder_type, service.name),
        html: `<p>${reminderMessage(reminder.reminder_type, service.expires_at)}</p><p><a href="${process.env.APP_URL ?? ""}/dashboard/services">Buka Dashboard</a></p>`,
        text: reminderMessage(reminder.reminder_type, service.expires_at),
      });
      if (mail.ok) result.emailSent++;
      else result.emailFailed++;
    }
    // WhatsApp: integrasi belum tersedia — tidak diklaim terkirim.
    result.sent++;
  }
  return result;
}

function reminderTitle(type: ReminderType, serviceName: string): string {
  switch (type) {
    case "expired":
      return `Layanan "${serviceName}" telah kedaluwarsa`;
    case "expiry_1d":
      return `Layanan "${serviceName}" kedaluwarsa besok`;
    case "expiry_3d":
      return `Layanan "${serviceName}" kedaluwarsa dalam 3 hari`;
    case "expiry_7d":
      return `Layanan "${serviceName}" kedaluwarsa dalam 7 hari`;
  }
}

function reminderMessage(type: ReminderType, expiresAt: string): string {
  switch (type) {
    case "expired":
      return `Masa layanan Anda telah berakhir pada ${formatDate(expiresAt)}. Perpanjang melalui dashboard bila layanan masih dapat diperpanjang.`;
    case "expiry_1d":
      return `Layanan Anda akan kedaluwarsa besok (${formatDate(expiresAt)}). Perpanjang sebelum masa layanan habis.`;
    case "expiry_3d":
      return `Layanan Anda akan kedaluwarsa dalam 3 hari (${formatDate(expiresAt)}).`;
    case "expiry_7d":
      return `Layanan Anda akan kedaluwarsa dalam 7 hari (${formatDate(expiresAt)}).`;
  }
}
