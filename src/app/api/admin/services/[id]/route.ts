import { api, fromZodError } from "@/lib/api/helpers";
import { servicePatchSchema } from "@/lib/validation/admin";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { refreshServiceStatuses, deriveServiceStatus } from "@/lib/services/lifecycle";
import { manualExtendService } from "@/lib/store/services";
import { auditLog } from "@/lib/audit";
import { nowIso } from "@/lib/utils";
import { ApiError } from "@/lib/security";
import type { ServiceInstance, ServiceRenewal, ServiceReminder } from "@/lib/types";

export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "services.view",
  handler: async ({ params }) => {
    await refreshServiceStatuses();
    const driver = getDriver();
    const service = await table<ServiceInstance>("service_instances", driver).findById(params.id);
    if (!service) throw new ApiError("Layanan tidak ditemukan.", "NOT_FOUND", 404);
    const [renewals, reminders, order] = await Promise.all([
      table<ServiceRenewal>("service_renewals", driver).find({ service_id: service.id }, { orderBy: [{ column: "created_at", dir: "desc" }] }),
      table<ServiceReminder>("service_reminders", driver).find({ service_id: service.id }, { orderBy: [{ column: "scheduled_at", dir: "asc" }] }),
      table("orders", driver).findById(String(service.order_id)),
    ]);
    const customer = await table("users", driver).findById(String(service.customer_id));
    return Response.json({
      success: true,
      data: { service, renewals, reminders, order, customer: customer ? { id: customer.id, email: customer.email } : null },
    });
  },
});

/**
 * PATCH /api/admin/services/[id] — ubah status, activation_at, expires_at,
 * renewable. Semua perubahan dicatat di audit log. Waktu server adalah
 * sumber kebenaran (browser tidak dipercaya).
 */
export const PATCH = api({
  methods: ["PATCH"],
  auth: "admin",
  permission: "services.manage",
  handler: async ({ request, params, user, ip }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = servicePatchSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const driver = getDriver();
    const service = await table<ServiceInstance>("service_instances", driver).findById(params.id);
    if (!service) throw new ApiError("Layanan tidak ditemukan.", "NOT_FOUND", 404);

    const patch: Record<string, unknown> = { updated_at: nowIso() };
    const meta: Record<string, unknown> = { reason: parsed.data.reason ?? "" };

    if (parsed.data.activationAt !== undefined && parsed.data.activationAt !== null) {
      const at = new Date(parsed.data.activationAt);
      if (Number.isNaN(at.getTime())) throw new ApiError("activation_at tidak valid.", "INVALID_DATE", 400);
      patch.activation_at = at.toISOString();
      meta.previousActivation = service.activation_at;
      meta.newActivation = patch.activation_at;
    }
    if (parsed.data.expiresAt !== undefined && parsed.data.expiresAt !== null) {
      const ex = new Date(parsed.data.expiresAt);
      if (Number.isNaN(ex.getTime())) throw new ApiError("expires_at tidak valid.", "INVALID_DATE", 400);
      if (ex.getTime() <= Date.now()) throw new ApiError("expires_at harus di masa depan.", "INVALID_DATE", 400);
      patch.expires_at = ex.toISOString();
      meta.previousExpiration = service.expires_at;
      meta.newExpiration = patch.expires_at;
    }
    if (parsed.data.renewable !== undefined) {
      patch.renewable = parsed.data.renewable;
      meta.renewable = parsed.data.renewable;
    }
    if (parsed.data.status !== undefined) {
      const allowed: string[] = ["pending", "scheduled", "active", "suspended", "expired", "cancelled", "terminated"];
      if (!allowed.includes(parsed.data.status)) throw new ApiError("Status tidak valid.", "INVALID_STATUS", 400);
      patch.status = parsed.data.status;
      meta.previousStatus = service.status;
      meta.newStatus = parsed.data.status;
    }

    const updated = await table<ServiceInstance>("service_instances", driver).update(service.id, patch);
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "service.update",
      resource: "service",
      resourceId: service.id,
      ip,
      metadata: meta,
    });
    return Response.json({ success: true, data: { service: updated } });
  },
});

/** POST /api/admin/services/[id] — aksi: extend (manual), notify, refresh-status. */
export const POST = api({
  methods: ["POST"],
  auth: "admin",
  permission: "services.manage",
  handler: async ({ request, params, user, ip }) => {
    const body = (await request.json().catch(() => null)) as { action?: string; newExpiresAt?: string; reason?: string } | null;
    const driver = getDriver();
    const service = await table<ServiceInstance>("service_instances", driver).findById(params.id);
    if (!service) throw new ApiError("Layanan tidak ditemukan.", "NOT_FOUND", 404);

    if (body?.action === "extend") {
      const updated = await manualExtendService({
        service,
        newExpiresAt: body.newExpiresAt ?? "",
        reason: body.reason ?? "Perpanjangan manual oleh admin",
        actor: { id: user.id, email: user.email },
      });
      return Response.json({ success: true, data: { service: updated, message: "Masa layanan diperpanjang." } });
    }

    if (body?.action === "notify") {
      await table("notifications", driver).insert({
        id: (await import("@/lib/utils")).newId(),
        user_id: service.customer_id,
        type: "service_info",
        title: "Informasi layanan",
        message: body.reason ?? `Pembaruan untuk layanan "${service.name}".`,
        link: "/dashboard/services",
        read_at: null,
        created_at: nowIso(),
      });
      await auditLog({
        actorType: "user",
        actorId: user.id,
        actorEmail: user.email,
        action: "service.notify",
        resource: "service",
        resourceId: service.id,
        ip,
      });
      return Response.json({ success: true, data: { message: "Notifikasi terkirim ke dashboard pelanggan." } });
    }

    if (body?.action === "refresh-status") {
      const derived = deriveServiceStatus(service);
      const updated = await table<ServiceInstance>("service_instances", driver).update(service.id, {
        status: derived,
        updated_at: nowIso(),
      });
      return Response.json({ success: true, data: { service: updated } });
    }

    throw new ApiError("Aksi tidak dikenali.", "INVALID_ACTION", 400);
  },
});
