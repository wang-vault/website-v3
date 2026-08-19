import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { auditLog } from "@/lib/audit";
import type { SavedConfiguration } from "@/lib/types";

/** PATCH/DELETE konfigurasi tersimpan milik user yang sedang login. */
export const PATCH = api({
  methods: ["PATCH"],
  auth: "required",
  handler: async ({ request, params, user, ip }) => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const configs = table<SavedConfiguration>("saved_configurations", getDriver());
    const config = await configs.findOne({ id: params.id, user_id: user.id });
    if (!config) {
      return Response.json({ success: false, error: { code: "NOT_FOUND", message: "Konfigurasi tidak ditemukan." } }, { status: 404 });
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body?.name === "string") patch.name = body.name.slice(0, 100);
    if (typeof body?.cpu === "number") patch.cpu = body.cpu;
    if (typeof body?.ram === "number") patch.ram = body.ram;
    if (typeof body?.storage === "number") patch.storage = body.storage;
    if (typeof body?.price === "number") patch.price = body.price;
    const updated = await configs.update(config.id as string, patch);
    await auditLog({ actorType: "user", actorId: user.id, actorEmail: user.email, action: "update", resource: "saved_configuration", resourceId: config.id, ip });
    return Response.json({ success: true, data: { configuration: updated } });
  },
});

export const DELETE = api({
  methods: ["DELETE"],
  auth: "required",
  handler: async ({ params, user, ip }) => {
    const configs = table<SavedConfiguration>("saved_configurations", getDriver());
    const config = await configs.findOne({ id: params.id, user_id: user.id });
    if (!config) {
      return Response.json({ success: false, error: { code: "NOT_FOUND", message: "Konfigurasi tidak ditemukan." } }, { status: 404 });
    }
    await configs.remove(config.id as string);
    await auditLog({ actorType: "user", actorId: user.id, actorEmail: user.email, action: "delete", resource: "saved_configuration", resourceId: config.id, ip });
    return Response.json({ success: true, data: { message: "Konfigurasi dihapus." } });
  },
});
