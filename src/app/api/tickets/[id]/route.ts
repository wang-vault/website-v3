import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { nowIso } from "@/lib/utils";
import { ApiError } from "@/lib/security";
import type { Ticket, TicketMessage } from "@/lib/types";

/** GET detail tiket (pemilik / staf) + POST tutup tiket oleh customer. */
export const GET = api({
  methods: ["GET"],
  auth: "optional",
  handler: async ({ params, user }) => {
    const driver = getDriver();
    const ticket = await table<Ticket>("tickets", driver).findById(params.id);
    if (!ticket) throw new ApiError("Tiket tidak ditemukan.", "NOT_FOUND", 404);
    const isOwner = user ? String(ticket.user_id) === user.id : false;
    const isStaff = user ? ["owner", "admin", "staff"].includes(user.roleSlug) : false;
    if (!isOwner && !isStaff) throw new ApiError("Akses ditolak.", "FORBIDDEN", 403);
    const messages = await table<TicketMessage>("ticket_messages", driver).find(
      { ticket_id: ticket.id },
      { orderBy: [{ column: "created_at", dir: "asc" }] },
    );
    return Response.json({ success: true, data: { ticket, messages } });
  },
});

export const POST = api({
  methods: ["POST"],
  auth: "required",
  handler: async ({ params, user }) => {
    const driver = getDriver();
    const ticket = await table<Ticket>("tickets", driver).findById(params.id);
    if (!ticket) throw new ApiError("Tiket tidak ditemukan.", "NOT_FOUND", 404);
    if (String(ticket.user_id) !== user.id) throw new ApiError("Akses ditolak.", "FORBIDDEN", 403);
    await table<Ticket>("tickets", driver).update(ticket.id, {
      status: "closed",
      closed_at: nowIso(),
      updated_at: nowIso(),
    });
    return Response.json({ success: true, data: { message: "Tiket ditutup." } });
  },
});
