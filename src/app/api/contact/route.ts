import { api, fromZodError } from "@/lib/api/helpers";
import { contactSchema } from "@/lib/validation";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { newId, nowIso, shortCode } from "@/lib/utils";
import { ApiError } from "@/lib/security";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import type { Ticket, TicketMessage } from "@/lib/types";

/** POST /api/contact — pesan kontak → dibuat sebagai tiket (kategori Kontak). */
export const POST = api({
  methods: ["POST"],
  rateLimit: { limit: RATE_LIMITS.contact },
  skipMaintenance: true,
  handler: async ({ request, user }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const driver = getDriver();
    const settings = await getSettings();
    const now = nowIso();
    const ticketNumber = await (async () => {
      for (let i = 0; i < 5; i++) {
        const candidate = shortCode("TK", 8);
        const exists = await table("tickets", driver).findOne({ ticket_number: candidate });
        if (!exists) return candidate;
      }
      throw new ApiError("Gagal membuat nomor tiket.", "TICKET_NUMBER_FAILED", 500);
    })();

    const ticket: Ticket = {
      id: newId(),
      ticket_number: ticketNumber,
      user_id: user?.id ?? null,
      name: parsed.data.name,
      email: parsed.data.email,
      whatsapp: parsed.data.whatsapp ?? "",
      subject: parsed.data.subject,
      category: "Kontak",
      priority: "normal",
      status: "open",
      created_at: now,
      updated_at: now,
      closed_at: null,
    };
    const message: TicketMessage = {
      id: newId(),
      ticket_id: ticket.id,
      sender_type: "customer",
      sender_id: user?.id ?? null,
      message: parsed.data.message,
      created_at: now,
    };
    await driver.tx(async (tx) => {
      await table<Ticket>("tickets", tx).insert(ticket);
      await table<TicketMessage>("ticket_messages", tx).insert(message);
    });

    return Response.json({
      success: true,
      data: {
        message: "Pesan Anda telah diterima. Tim kami akan merespons melalui email atau WhatsApp.",
        ticketNumber: ticket.ticket_number,
        contact: {
          whatsapp: settings.whatsappNumber,
          discord: settings.discordUrl,
          email: settings.emailPublic,
        },
      },
    });
  },
});
