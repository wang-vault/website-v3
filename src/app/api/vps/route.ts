import { api } from "@/lib/api/helpers";
import { getLocations, getVpsPackages } from "@/lib/store/catalog";

/** GET /api/vps — paket VPS orderable dari database. */
export const GET = api({
  methods: ["GET"],
  handler: async () => {
    const [packages, locations] = await Promise.all([getVpsPackages(true), getLocations()]);
    const locationMap = new Map(locations.map((l) => [l.id, l]));
    return Response.json({
      success: true,
      data: {
        packages: packages.map((p) => {
          const loc = p.location_id ? locationMap.get(p.location_id) : null;
          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            cpu: p.cpu,
            ram: p.ram,
            storage: p.storage,
            bandwidth: p.bandwidth,
            ipv4Available: p.ipv4_available,
            location: loc ? { id: loc.id, name: loc.name, country: loc.country, city: loc.city } : null,
            virtualization: p.virtualization,
            price: p.price,
            billingPeriod: p.billing_period,
            renewable: p.renewable,
            description: p.description,
            features: Array.isArray(p.features) ? p.features : [],
            status: p.status,
          };
        }),
      },
    });
  },
});
