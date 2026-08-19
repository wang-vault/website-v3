import { api, fromZodError } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { newId, nowIso } from "@/lib/utils";
import { savedConfigSchema } from "@/lib/validation";
import { auditLog } from "@/lib/audit";
import type { SavedConfiguration } from "@/lib/types";

/** Konfigurasi tersimpan: simpan ke akun (user) atau lokal guest (browser storage). */
export const GET = api({
  methods: ["GET"],
  auth: "required",
  handler: async ({ user }) => {
    const rows = await table<SavedConfiguration>("saved_configurations", getDriver()).find(
      { user_id: user.id },
      { orderBy: [{ column: "updated_at", dir: "desc" }] },
    );
    return Response.json({ success: true, data: { configurations: rows } });
  },
});

export const POST = api({
  methods: ["POST"],
  auth: "required",
  handler: async ({ request, user, ip }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = savedConfigSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);
    const now = nowIso();
    const config: SavedConfiguration = {
      id: newId(),
      user_id: user.id,
      guest_key: null,
      name: parsed.data.name || "Konfigurasi Saya",
      tier_slug: parsed.data.tierSlug,
      package_id: parsed.data.packageId ?? null,
      cpu: parsed.data.cpu ?? 0,
      ram: parsed.data.ram ?? 0,
      storage: parsed.data.storage ?? 0,
      price: parsed.data.price ?? 0,
      created_at: now,
      updated_at: now,
    };
    await table<SavedConfiguration>("saved_configurations", getDriver()).insert(config);
    await auditLog({ actorType: "user", actorId: user.id, actorEmail: user.email, action: "create", resource: "saved_configuration", resourceId: config.id, ip });
    return Response.json({ success: true, data: { configuration: config } });
  },
});

export const DELETE = api({
  methods: ["DELETE"],
  auth: "required",
  handler: async ({ user, ip }) => {
    // Hapus semua konfigurasi user (untuk pembersihan akun).
    const removed = await table<SavedConfiguration>("saved_configurations", getDriver()).removeWhere({ user_id: user.id });
    await auditLog({ actorType: "user", actorId: user.id, actorEmail: user.email, action: "delete", resource: "saved_configuration", ip, metadata: { removed } });
    return Response.json({ success: true, data: { removed } });
  },
});
