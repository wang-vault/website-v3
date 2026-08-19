import { api, fromZodError } from "@/lib/api/helpers";
import { serverPackageSchema } from "@/lib/validation/admin";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { nowIso } from "@/lib/utils";
import { getTierBySlug, syncProduct } from "@/lib/store/catalog";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/security";
import type { ServerPackage } from "@/lib/types";

export const PATCH = api({
  methods: ["PATCH"],
  auth: "admin",
  permission: "packages.manage",
  handler: async ({ request, params, user, ip }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = serverPackageSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const driver = getDriver();
    const packages = table<ServerPackage>("server_packages", driver);
    const existing = await packages.findById(params.id);
    if (!existing) throw new ApiError("Paket tidak ditemukan.", "NOT_FOUND", 404);

    const tier = await getTierBySlug(parsed.data.tierSlug);
    if (!tier || tier.mode !== "package") throw new ApiError("Tier tidak valid.", "TIER_INVALID", 422);

    const patch = {
      tier_id: tier.id,
      name: parsed.data.name,
      cpu: parsed.data.cpu,
      ram: parsed.data.ram,
      storage: parsed.data.storage,
      price: parsed.data.price,
      description: parsed.data.description ?? "",
      status: parsed.data.status,
      visible: parsed.data.visible,
      orderable: parsed.data.orderable,
      popular: parsed.data.popular,
      popular_label: parsed.data.popularLabel || (parsed.data.popular ? "Populer" : null),
      performance_factor: parsed.data.performanceFactor ?? 1,
      updated_at: nowIso(),
    };
    const updated = await packages.update(existing.id, patch);
    await syncProduct({
      type: "server_builder",
      name: patch.name,
      slug: String(existing.slug),
      description: patch.description,
      status: patch.status,
      visibility: patch.visible,
      price: patch.price,
      tierId: tier.id,
      serverPackageId: existing.id,
    });
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "update",
      resource: "server_package",
      resourceId: existing.id,
      ip,
      metadata: { tier: tier.slug, name: patch.name, price: patch.price, status: patch.status, orderable: patch.orderable },
    });
    return Response.json({ success: true, data: { package: updated } });
  },
});

export const DELETE = api({
  methods: ["DELETE"],
  auth: "admin",
  permission: "packages.manage",
  handler: async ({ params, user, ip }) => {
    const driver = getDriver();
    const packages = table<ServerPackage>("server_packages", driver);
    const existing = await packages.findById(params.id);
    if (!existing) throw new ApiError("Paket tidak ditemukan.", "NOT_FOUND", 404);
    await packages.update(existing.id, { archived_at: nowIso(), status: "inactive", orderable: false, updated_at: nowIso() });
    await syncProduct({
      type: "server_builder",
      name: existing.name,
      slug: String(existing.slug),
      description: String(existing.description),
      status: "inactive",
      visibility: false,
      price: existing.price,
      tierId: String(existing.tier_id),
      serverPackageId: existing.id,
    });
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "archive",
      resource: "server_package",
      resourceId: existing.id,
      ip,
    });
    return Response.json({ success: true, data: { message: "Paket diarsipkan (tidak dapat dipesan)." } });
  },
});
