import { api, fromZodError } from "@/lib/api/helpers";
import { vpsPackageSchema } from "@/lib/validation/admin";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { newId, nowIso } from "@/lib/utils";
import { uniqueSlug, syncProduct } from "@/lib/store/catalog";
import { auditLog } from "@/lib/audit";
import type { VpsPackage } from "@/lib/types";

export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "vps.view",
  handler: async () => {
    const rows = await table<VpsPackage>("vps_packages", getDriver()).find({}, { orderBy: [{ column: "created_at", dir: "desc" }] });
    return Response.json({ success: true, data: { packages: rows } });
  },
});

/** POST — buat paket VPS (Owner/Admin dengan permission vps.manage). */
export const POST = api({
  methods: ["POST"],
  auth: "admin",
  permission: "vps.manage",
  handler: async ({ request, user, ip }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = vpsPackageSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const driver = getDriver();
    const now = nowIso();
    const slug = await uniqueSlug("vps_packages", parsed.data.name);
    const pkg: VpsPackage = {
      id: newId(),
      name: parsed.data.name,
      slug,
      cpu: parsed.data.cpu,
      ram: parsed.data.ram,
      storage: parsed.data.storage,
      bandwidth: parsed.data.bandwidth ?? "",
      ipv4_available: parsed.data.ipv4Available,
      location_id: parsed.data.locationId ?? null,
      virtualization: parsed.data.virtualization || "KVM",
      price: parsed.data.price,
      billing_period: parsed.data.billingPeriod || "monthly",
      renewable: parsed.data.renewable,
      description: parsed.data.description ?? "",
      features: parsed.data.features ?? [],
      status: parsed.data.status,
      visible: parsed.data.visible,
      stock: parsed.data.stock ?? null,
      created_by: user.id,
      archived_at: null,
      created_at: now,
      updated_at: now,
    };
    await table("vps_packages", driver).insert(pkg);
    await syncProduct({
      type: "vps",
      name: pkg.name,
      slug: pkg.slug,
      description: pkg.description,
      status: pkg.status,
      visibility: pkg.visible,
      price: pkg.price,
      vpsPackageId: pkg.id,
    });
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "create",
      resource: "vps_package",
      resourceId: pkg.id,
      ip,
      metadata: { name: pkg.name, price: pkg.price, status: pkg.status },
    });
    return Response.json({ success: true, data: { package: pkg } });
  },
});
