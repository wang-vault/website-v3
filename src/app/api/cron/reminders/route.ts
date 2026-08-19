import { runDueReminders } from "@/lib/services/reminders";
import { ApiError } from "@/lib/security";

/**
 * POST /api/cron/reminders — scheduler serverless untuk pengingat layanan.
 * Vercel Cron: konfigurasikan cron job yang memanggil endpoint ini dengan
 * header Authorization: Bearer <CRON_SECRET> (lihat docs/DEPLOYMENT.md).
 *
 * Idempotent: unique constraint (service_id, reminder_type) + claim status
 * mencegah pengiriman ganda walau dipanggil berulang.
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return Response.json(
      { success: false, error: { code: "CRON_NOT_CONFIGURED", message: "CRON_SECRET belum dikonfigurasi." } },
      { status: 503 },
    );
  }
  if (auth !== `Bearer ${expected}`) {
    throw new ApiError("Unauthorized.", "UNAUTHORIZED", 401);
  }
  const result = await runDueReminders();
  return Response.json({ success: true, data: result });
}
