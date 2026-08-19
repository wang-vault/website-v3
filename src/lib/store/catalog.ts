import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { newId, nowIso } from "@/lib/utils";
import { slugify } from "@/lib/utils/format";
import type { Product, ServerPackage, ServerTier, VpsPackage, VpsLocation } from "@/lib/types";
import { ApiError } from "@/lib/security";
import { toRuleSet } from "@/lib/pricing";

export async function getTiers(includeInactive = false): Promise<ServerTier[]> {
  const rows = await table<ServerTier>("server_tiers", getDriver()).find(
    includeInactive ? {} : { status: "active", visible: true },
    { orderBy: [{ column: "sort", dir: "asc" }] },
  );
  return rows.map((r) => ({ ...r, performance_factor: Number(r.performance_factor) }));
}

export async function getTierBySlug(slug: string): Promise<ServerTier | null> {
  const row = await table<ServerTier>("server_tiers", getDriver()).findOne({ slug });
  return row ? { ...row, performance_factor: Number(row.performance_factor) } : null;
}

export async function getLowPricingRulesRow() {
  const tier = await getTierBySlug("low");
  if (!tier) return null;
  const row = await table("pricing_rules", getDriver()).findOne({ tier_id: tier.id });
  return row ?? null;
}

/** Aturan harga Low yang siap dipakai modul pricing. */
export async function getLowRuleSet() {
  const row = await getLowPricingRulesRow();
  if (!row) return null;
  return toRuleSet(row as never);
}

/** Paket yang boleh DITAMPILKAN untuk tier package (medium/high): visible + bukan inactive. */
export async function getVisiblePackages(tierSlug: string): Promise<ServerPackage[]> {
  const tier = await getTierBySlug(tierSlug);
  if (!tier) return [];
  const rows = await table<ServerPackage>("server_packages", getDriver()).find(
    { tier_id: tier.id, visible: true, status: { op: "ne", value: "inactive" } },
    { orderBy: [{ column: "price", dir: "asc" }] },
  );
  return rows.map((r) => ({ ...r, performance_factor: Number(r.performance_factor) }));
}

/** Paket yang boleh DIPESAN: status available + orderable. */
export async function getOrderablePackages(tierSlug: string): Promise<ServerPackage[]> {
  const tier = await getTierBySlug(tierSlug);
  if (!tier) return [];
  const rows = await table<ServerPackage>("server_packages", getDriver()).find(
    { tier_id: tier.id, status: "available", orderable: true, visible: true, archived_at: null },
  );
  return rows.map((r) => ({ ...r, performance_factor: Number(r.performance_factor) }));
}

export async function getServerPackageById(id: string): Promise<ServerPackage | null> {
  const row = await table<ServerPackage>("server_packages", getDriver()).findById(id);
  return row ? { ...row, performance_factor: Number(row.performance_factor) } : null;
}

export async function getVpsPackages(onlyOrderable = false): Promise<VpsPackage[]> {
  const where: Record<string, unknown> = onlyOrderable
    ? { status: "available", visible: true, archived_at: null }
    : { visible: true, archived_at: null };
  const rows = await table<VpsPackage>("vps_packages", getDriver()).find(where, {
    orderBy: [{ column: "price", dir: "asc" }],
  });
  return rows;
}

export async function getVpsPackageById(id: string): Promise<VpsPackage | null> {
  return table<VpsPackage>("vps_packages", getDriver()).findById(id);
}

export async function getLocations(includeInactive = false): Promise<VpsLocation[]> {
  return table<VpsLocation>("vps_locations", getDriver()).find(
    includeInactive ? {} : { status: "active" },
    { orderBy: [{ column: "name", dir: "asc" }] },
  );
}

/** Sinkronkan baris produk katalog (satu katalog, tidak duplikat). */
export async function syncProduct(input: {
  type: "server_builder" | "vps";
  name: string;
  slug: string;
  description: string;
  status: string;
  visibility: boolean;
  price: number;
  tierId?: string | null;
  serverPackageId?: string | null;
  vpsPackageId?: string | null;
}): Promise<void> {
  const driver = getDriver();
  const products = table<Product>("products", driver);
  const key =
    input.type === "server_builder"
      ? { server_package_id: input.serverPackageId ?? null }
      : { vps_package_id: input.vpsPackageId ?? null };
  const existing = await products.findOne(key);
  const now = nowIso();
  if (existing) {
    await products.update(existing.id as string, {
      name: input.name,
      slug: input.slug,
      description: input.description,
      status: input.status,
      visibility: input.visibility,
      price: input.price,
      tier_id: input.tierId ?? null,
      server_package_id: input.serverPackageId ?? null,
      vps_package_id: input.vpsPackageId ?? null,
      updated_at: now,
    });
    return;
  }
  await products.insert({
    id: newId(),
    type: input.type,
    name: input.name,
    slug: input.slug,
    description: input.description,
    tier_id: input.tierId ?? null,
    server_package_id: input.serverPackageId ?? null,
    vps_package_id: input.vpsPackageId ?? null,
    status: input.status,
    visibility: input.visibility,
    price: input.price,
    metadata: {},
    created_at: now,
    updated_at: now,
  });
}

/** Slug unik untuk package (tambahkan sufiks bila tabrakan). */
export async function uniqueSlug(tableName: "server_packages" | "vps_packages" | "blog_posts" | "knowledge_articles", base: string, excludeId?: string): Promise<string> {
  const slug = slugify(base) || "item";
  let candidate = slug;
  let i = 2;
  for (;;) {
    const existing = await table(tableName, getDriver()).findOne({ slug: candidate });
    if (!existing || (excludeId && String(existing.id) === excludeId)) return candidate;
    candidate = `${slug}-${i}`;
    i++;
  }
}

export async function assertPackageOrderable(pkg: ServerPackage | null, tierSlug: string): Promise<ServerPackage> {
  if (!pkg) {
    throw new ApiError("Paket tidak ditemukan.", "PACKAGE_NOT_FOUND", 422);
  }
  const tier = await getTierBySlug(tierSlug);
  if (!tier || pkg.tier_id !== tier.id) {
    throw new ApiError("Paket tidak valid untuk tier ini.", "PACKAGE_INVALID", 422);
  }
  if (pkg.status !== "available" || !pkg.orderable) {
    throw new ApiError("Paket sedang tidak dapat dipesan.", "PACKAGE_NOT_ORDERABLE", 409);
  }
  if (pkg.archived_at) {
    throw new ApiError("Paket tidak ditemukan.", "PACKAGE_NOT_FOUND", 422);
  }
  return pkg;
}

export async function getProductById(id: string): Promise<Product | null> {
  return table<Product>("products", getDriver()).findById(id);
}
