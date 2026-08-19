import { api, fromZodError } from "@/lib/api/helpers";
import { ticketReplySchema } from "@/lib/validation";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { newId, nowIso } from "@/lib/utils";
import { ApiError } from "@/lib/security";
import type { Ticket, TicketMessage } from "@/lib/types";

export const POST = api({
  methods: ["POST"],
  auth: "optional",
  handler: async ({ request, params, user, ip }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = ticketReplySchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const driver = getDriver();
    const ticket = await table<Ticket>("tickets", driver).findById(params.id);
    if (!ticket) throw new ApiError("Tiket tidak ditemukan.", "NOT_FOUND", 404);
    if (ticket.status === "closed") throw new ApiError("Tiket sudah ditutup.", "TICKET_CLOSED", 400);

    const isOwner = user ? String(ticket.user_id) === user.id : false;
    const isStaff = user ? ["owner", "admin", "staff"].includes(user.roleSlug) : false;
    if (!isOwner && !isStaff) {
      // Guest: izinkan bila email cocok dengan email tiket.
      const guestEmail = String(request.headers.get("x-guest-email") ?? "").toLowerCase();
      if (!guestEmail || guestEmail !== String(ticket.email).toLowerCase()) {
        throw new ApiError("Akses ditolak.", "FORBIDDEN", 403);
      }
    }

    const message: TicketMessage = {
      id: newId(),
      ticket_id: ticket.id,
      sender_type: isStaff ? "staff" : "customer",
      sender_id: user?.id ?? null,
      message: parsed.data.message,
      created_at: nowIso(),
    };
    await driver.tx(async (tx) => {
      await table<TicketMessage>("ticket_messages", tx).insert(message);
      await table<Ticket>("tickets", tx).update(ticket.id, {
        status: isStaff ? "answered" : "customer_reply",
        updated_at: nowIso(),
      });
    });
    void ip;
    return Response.json({ success: true, data: { message } });
  },
});
