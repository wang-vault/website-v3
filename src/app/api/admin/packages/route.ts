import { api, fromZodError } from "@/lib/api/helpers";
import { serverPackageSchema } from "@/lib/validation/admin";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { newId, nowIso } from "@/lib/utils";
import { getTierBySlug, uniqueSlug, syncProduct } from "@/lib/store/catalog";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/security";
import type { ServerPackage, ServerTier } from "@/lib/types";

/** Paket Server Builder Medium/High — pengelolaan KHUSUS OWNER (permission packages.manage). */

export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "packages.view",
  handler: async () => {
    const driver = getDriver();
    const [rows, tiers] = await Promise.all([
      table<ServerPackage>("server_packages", driver).find({}, { orderBy: [{ column: "created_at", dir: "desc" }] }),
      table<ServerTier>("server_tiers", driver).all(),
    ]);
    const tierMap = new Map(tiers.map((t) => [t.id, t]));
    return Response.json({
      success: true,
      data: {
        packages: rows.map((p) => ({ ...p, tierSlug: tierMap.get(String(p.tier_id))?.slug ?? null })),
      },
    });
  },
});

export const POST = api({
  methods: ["POST"],
  auth: "admin",
  permission: "packages.manage",
  handler: async ({ request, user, ip }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = serverPackageSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const tier = await getTierBySlug(parsed.data.tierSlug);
    if (!tier || tier.mode !== "package") {
      throw new ApiError("Tier tidak valid untuk paket.", "TIER_INVALID", 422);
    }
    const driver = getDriver();
    const now = nowIso();
    const slug = await uniqueSlug("server_packages", parsed.data.name);
    const pkg: ServerPackage = {
      id: newId(),
      tier_id: tier.id,
      name: parsed.data.name,
      slug,
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
      created_by: user.id,
      archived_at: null,
      created_at: now,
      updated_at: now,
    };
    await table("server_packages", driver).insert(pkg);
    await syncProduct({
      type: "server_builder",
      name: pkg.name,
      slug: pkg.slug,
      description: pkg.description,
      status: pkg.status,
      visibility: pkg.visible,
      price: pkg.price,
      tierId: tier.id,
      serverPackageId: pkg.id,
    });
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "create",
      resource: "server_package",
      resourceId: pkg.id,
      ip,
      metadata: { tier: tier.slug, name: pkg.name, price: pkg.price, status: pkg.status },
    });
    return Response.json({ success: true, data: { package: pkg } });
  },
});
