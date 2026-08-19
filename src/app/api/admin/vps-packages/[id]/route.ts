import { api, fromZodError } from "@/lib/api/helpers";
import { vpsPackageSchema } from "@/lib/validation/admin";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { nowIso } from "@/lib/utils";
import { syncProduct } from "@/lib/store/catalog";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/security";
import type { VpsPackage } from "@/lib/types";

export const PATCH = api({
  methods: ["PATCH"],
  auth: "admin",
  permission: "vps.manage",
  handler: async ({ request, params, user, ip }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = vpsPackageSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const driver = getDriver();
    const packages = table<VpsPackage>("vps_packages", driver);
    const existing = await packages.findById(params.id);
    if (!existing) throw new ApiError("Paket VPS tidak ditemukan.", "NOT_FOUND", 404);

    const patch = {
      name: parsed.data.name,
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
      updated_at: nowIso(),
    };
    const updated = await packages.update(existing.id, patch);
    await syncProduct({
      type: "vps",
      name: patch.name,
      slug: String(existing.slug),
      description: patch.description,
      status: patch.status,
      visibility: patch.visible,
      price: patch.price,
      vpsPackageId: existing.id,
    });
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "update",
      resource: "vps_package",
      resourceId: existing.id,
      ip,
      metadata: { name: patch.name, price: patch.price, status: patch.status },
    });
    return Response.json({ success: true, data: { package: updated } });
  },
});

export const DELETE = api({
  methods: ["DELETE"],
  auth: "admin",
  permission: "vps.manage",
  handler: async ({ params, user, ip }) => {
    const driver = getDriver();
    const packages = table<VpsPackage>("vps_packages", driver);
    const existing = await packages.findById(params.id);
    if (!existing) throw new ApiError("Paket VPS tidak ditemukan.", "NOT_FOUND", 404);
    // Soft-delete (archive)
    await packages.update(existing.id, { archived_at: nowIso(), status: "inactive", updated_at: nowIso() });
    await syncProduct({
      type: "vps",
      name: existing.name,
      slug: String(existing.slug),
      description: String(existing.description),
      status: "inactive",
      visibility: false,
      price: existing.price,
      vpsPackageId: existing.id,
    });
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "archive",
      resource: "vps_package",
      resourceId: existing.id,
      ip,
    });
    return Response.json({ success: true, data: { message: "Paket VPS diarsipkan." } });
  },
});
