import { api } from "@/lib/api/helpers";
import { getVisiblePackages } from "@/lib/store/catalog";

/**
 * GET /api/packages?tier=medium|high
 * Paket Medium/High dari DATABASE (dikelola Owner di Admin Panel).
 * Jika belum ada paket, kembalikan array kosong — bukan paket fiktif.
 */
export const GET = api({
  methods: ["GET"],
  handler: async ({ request }) => {
    const url = new URL(request.url);
    const tier = url.searchParams.get("tier");
    if (!tier || !["medium", "high"].includes(tier)) {
      return Response.json({ success: true, data: { packages: [], tier } });
    }
    const packages = await getVisiblePackages(tier);
    return Response.json({
      success: true,
      data: {
        packages: packages.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          cpu: p.cpu,
          ram: p.ram,
          storage: p.storage,
          price: p.price,
          description: p.description,
          status: p.status,
          orderable: p.orderable,
          popular: p.popular,
          popularLabel: p.popular_label,
          performanceFactor: p.performance_factor,
        })),
      },
    });
  },
});
