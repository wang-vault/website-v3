import { api, fromZodError } from "@/lib/api/helpers";
import { z } from "zod";
import { getLowPricingRulesRow, getTierBySlug } from "@/lib/store/catalog";
import { toRuleSet, normalizeLowConfig, calculateLowPrice, estimatePerformance, tierPerformanceFactor } from "@/lib/pricing";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { ApiError } from "@/lib/security";

const schema = z.object({
  cpu: z.number().int().optional(),
  ram: z.number().int().optional(),
  storage: z.number().int().optional(),
});

/** POST /api/pricing/estimate — estimasi harga & performa Tier Low (shared module). */
export const POST = api({
  methods: ["POST"],
  rateLimit: { limit: RATE_LIMITS.estimate },
  handler: async ({ request }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError("JSON tidak valid.", "INVALID_JSON", 400);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    const rulesRow = await getLowPricingRulesRow();
    if (!rulesRow) throw new ApiError("Aturan harga belum dikonfigurasi.", "PRICING_NOT_CONFIGURED", 500);
    const rules = toRuleSet(rulesRow as never);
    const normalized = normalizeLowConfig(parsed.data, rules);
    const price = calculateLowPrice(normalized, rules);
    const tier = await getTierBySlug("low");
    const estimate = estimatePerformance(normalized, tierPerformanceFactor(tier));

    return Response.json({
      success: true,
      data: {
        config: { cpu: normalized.cpu, ram: normalized.ram, storage: normalized.storage },
        normalizedFrom: normalized.original,
        price,
        estimate,
      },
    });
  },
});
