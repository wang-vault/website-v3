import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { Product } from "@/lib/types";

/** GET /api/products — katalog produk orderable (server_builder + vps). */
export const GET = api({
  methods: ["GET"],
  handler: async () => {
    const rows = await table<Product>("products", getDriver()).find(
      { status: "available", visibility: true },
      { orderBy: [{ column: "name", dir: "asc" }], limit: 200 },
    );
    return Response.json({
      success: true,
      data: {
        products: rows.map((p) => ({
          id: p.id,
          type: p.type,
          name: p.name,
          slug: p.slug,
          description: p.description,
          price: p.price,
          tierId: p.tier_id,
          serverPackageId: p.server_package_id,
          vpsPackageId: p.vps_package_id,
        })),
      },
    });
  },
});
