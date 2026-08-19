import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { auditLog } from "@/lib/audit";
import { nowIso } from "@/lib/utils";
import { ApiError } from "@/lib/security";
import type { Ticket, TicketMessage } from "@/lib/types";

export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "tickets.view",
  handler: async ({ params }) => {
    const driver = getDriver();
    const ticket = await table<Ticket>("tickets", driver).findById(params.id);
    if (!ticket) throw new ApiError("Tiket tidak ditemukan.", "NOT_FOUND", 404);
    const messages = await table<TicketMessage>("ticket_messages", driver).find(
      { ticket_id: ticket.id },
      { orderBy: [{ column: "created_at", dir: "asc" }] },
    );
    return Response.json({ success: true, data: { ticket, messages } });
  },
});

/** PATCH — ubah status/prioritas/kategori tiket (tickets.manage). */
export const PATCH = api({
  methods: ["PATCH"],
  auth: "admin",
  permission: "tickets.manage",
  handler: async ({ request, params, user, ip }) => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const driver = getDriver();
    const ticket = await table<Ticket>("tickets", driver).findById(params.id);
    if (!ticket) throw new ApiError("Tiket tidak ditemukan.", "NOT_FOUND", 404);
    const patch: Record<string, unknown> = { updated_at: nowIso() };
    const meta: Record<string, unknown> = {};
    if (typeof body?.status === "string" && ["open", "answered", "customer_reply", "closed"].includes(body.status)) {
      patch.status = body.status;
      meta.status = body.status;
      if (body.status === "closed") patch.closed_at = nowIso();
    }
    if (typeof body?.priority === "string" && ["rendah", "normal", "tinggi", "kritis"].includes(body.priority)) {
      patch.priority = body.priority;
      meta.priority = body.priority;
    }
    if (typeof body?.category === "string" && body.category.trim()) {
      patch.category = body.category.trim().slice(0, 100);
      meta.category = patch.category;
    }
    const updated = await table<Ticket>("tickets", driver).update(ticket.id, patch);
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "ticket.update",
      resource: "ticket",
      resourceId: ticket.id,
      ip,
      metadata: meta,
    });
    return Response.json({ success: true, data: { ticket: updated } });
  },
});
