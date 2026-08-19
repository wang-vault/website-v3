import { api } from "@/lib/api/helpers";
import { getLocations, getVpsPackageById } from "@/lib/store/catalog";

export const GET = api({
  methods: ["GET"],
  handler: async ({ params }) => {
    const pkg = await getVpsPackageById(params.id);
    if (!pkg || pkg.status !== "available" || !pkg.visible || pkg.archived_at) {
      return Response.json(
        { success: false, error: { code: "PACKAGE_NOT_FOUND", message: "Paket VPS tidak ditemukan." } },
        { status: 404 },
      );
    }
    const loc = pkg.location_id ? (await getLocations()).find((l) => l.id === pkg.location_id) : null;
    return Response.json({
      success: true,
      data: {
        id: pkg.id,
        name: pkg.name,
        slug: pkg.slug,
        cpu: pkg.cpu,
        ram: pkg.ram,
        storage: pkg.storage,
        bandwidth: pkg.bandwidth,
        ipv4Available: pkg.ipv4_available,
        location: loc ? { id: loc.id, name: loc.name, country: loc.country, city: loc.city } : null,
        virtualization: pkg.virtualization,
        price: pkg.price,
        billingPeriod: pkg.billing_period,
        renewable: pkg.renewable,
        description: pkg.description,
        features: Array.isArray(pkg.features) ? pkg.features : [],
        status: pkg.status,
      },
    });
  },
});
