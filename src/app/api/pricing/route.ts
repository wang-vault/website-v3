import { api } from "@/lib/api/helpers";
import { getTiers, getLowPricingRulesRow } from "@/lib/store/catalog";
import { toRuleSet, defaultLowConfig, calculateLowPrice, ABSOLUTE_SAFETY_LIMITS } from "@/lib/pricing";

/** GET /api/pricing — tier + aturan harga Low (satu sumber kebenaran). */
export const GET = api({
  methods: ["GET"],
  handler: async () => {
    const [tiers, rulesRow] = await Promise.all([getTiers(), getLowPricingRulesRow()]);
    const rules = rulesRow ? toRuleSet(rulesRow as never) : null;
    const def = rules ? defaultLowConfig(rules) : null;
    const price = rules && def ? calculateLowPrice(def, rules) : null;
    return Response.json({
      success: true,
      data: {
        tiers: tiers.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          mode: t.mode,
          description: t.description,
          orderable: t.orderable,
          performanceFactor: t.performance_factor,
        })),
        low: rules
          ? {
              limits: {
                cpu: rules.cpu,
                ram: rules.ram,
                storage: rules.storage,
              },
              safetyLimits: ABSOLUTE_SAFETY_LIMITS,
              prices: {
                base: rules.base,
                perCore: rules.perCore,
                perGbRam: rules.perGbRam,
                perGbStorage: rules.perGbStorage,
                minPrice: rules.minPrice,
                maxPrice: rules.maxPrice,
                rounding: rules.rounding,
              },
              defaultConfig: def,
              defaultPrice: price,
            }
          : null,
      },
    });
  },
});
