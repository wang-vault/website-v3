import { api, fromZodError } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { newId, nowIso, shortCode } from "@/lib/utils";
import { ticketCreateSchema } from "@/lib/validation";
import { ApiError } from "@/lib/security";
import { RATE_LIMITS } from "@/lib/rate-limit";
import type { Ticket, TicketMessage } from "@/lib/types";

export const GET = api({
  methods: ["GET"],
  auth: "required",
  handler: async ({ user }) => {
    const rows = await table<Ticket>("tickets", getDriver()).find(
      { user_id: user.id },
      { orderBy: [{ column: "updated_at", dir: "desc" }] },
    );
    return Response.json({ success: true, data: { tickets: rows } });
  },
});

/** POST /api/tickets — buat tiket (customer atau guest via kontak). */
export const POST = api({
  methods: ["POST"],
  auth: "optional",
  rateLimit: { limit: RATE_LIMITS.contact },
  handler: async ({ request, user, ip }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = ticketCreateSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const driver = getDriver();
    const ticketNumber = await generateTicketNumber(driver);
    const now = nowIso();
    const ticket: Ticket = {
      id: newId(),
      ticket_number: ticketNumber,
      user_id: user?.id ?? null,
      name: parsed.data.name,
      email: parsed.data.email,
      whatsapp: parsed.data.whatsapp ?? "",
      subject: parsed.data.subject,
      category: parsed.data.category,
      priority: parsed.data.priority,
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
    void ip;
    return Response.json({
      success: true,
      data: { ticket: { id: ticket.id, ticketNumber: ticket.ticket_number, status: ticket.status } },
    });
  },
});

async function generateTicketNumber(driver: ReturnType<typeof getDriver>): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = shortCode("TK", 8);
    const exists = await table("tickets", driver).findOne({ ticket_number: candidate });
    if (!exists) return candidate;
  }
  throw new ApiError("Gagal membuat nomor tiket.", "TICKET_NUMBER_FAILED", 500);
}
