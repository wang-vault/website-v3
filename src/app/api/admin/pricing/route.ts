import { api, fromZodError } from "@/lib/api/helpers";
import { pricingRulesSchema } from "@/lib/validation/admin";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { getLowPricingRulesRow } from "@/lib/store/catalog";
import { toRuleSet, ABSOLUTE_SAFETY_LIMITS, calculateLowPrice, defaultLowConfig } from "@/lib/pricing";
import { auditLog } from "@/lib/audit";
import { nowIso } from "@/lib/utils";
import { ApiError } from "@/lib/security";

export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "pricing.view",
  handler: async () => {
    const row = await getLowPricingRulesRow();
    if (!row) throw new ApiError("Aturan harga belum dikonfigurasi.", "PRICING_NOT_CONFIGURED", 500);
    const rules = toRuleSet(row as never);
    const def = defaultLowConfig(rules);
    return Response.json({
      success: true,
      data: {
        rules,
        safetyLimits: ABSOLUTE_SAFETY_LIMITS,
        defaultConfig: def,
        defaultPrice: calculateLowPrice(def, rules),
        version: Number(row.version),
      },
    });
  },
});

/** PATCH — ubah formula & batas Tier Low (admin dengan pricing.manage). */
export const PATCH = api({
  methods: ["PATCH"],
  auth: "admin",
  permission: "pricing.manage",
  handler: async ({ request, user, ip }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = pricingRulesSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    // Validasi keamanan: batas aturan tidak boleh melewati safety limit absolut.
    const check = (name: string, min: number, max: number, step: number) => {
      const s = ABSOLUTE_SAFETY_LIMITS[name as keyof typeof ABSOLUTE_SAFETY_LIMITS];
      if (min < s.min || max > s.max || step < 1 || (max - min) % step !== 0) {
        throw new ApiError(
          `Batas ${name} tidak valid (min ${s.min}, max ${s.max}, step harus membagi rentang).`,
          "LIMITS_INVALID",
          400,
        );
      }
    };
    check("cpu", parsed.data.cpu.min, parsed.data.cpu.max, parsed.data.cpu.step);
    check("ram", parsed.data.ram.min, parsed.data.ram.max, parsed.data.ram.step);
    check("storage", parsed.data.storage.min, parsed.data.storage.max, parsed.data.storage.step);

    const row = await getLowPricingRulesRow();
    if (!row) throw new ApiError("Aturan harga belum dikonfigurasi.", "PRICING_NOT_CONFIGURED", 500);
    const version = Number(row.version) + 1;

    const patch = {
      base: parsed.data.base,
      per_core: parsed.data.perCore,
      per_gb_ram: parsed.data.perGbRam,
      per_gb_storage: parsed.data.perGbStorage,
      min_price: parsed.data.minPrice,
      max_price: parsed.data.maxPrice ?? null,
      rounding: parsed.data.rounding,
      cpu_min: parsed.data.cpu.min,
      cpu_max: parsed.data.cpu.max,
      cpu_step: parsed.data.cpu.step,
      ram_min: parsed.data.ram.min,
      ram_max: parsed.data.ram.max,
      ram_step: parsed.data.ram.step,
      storage_min: parsed.data.storage.min,
      storage_max: parsed.data.storage.max,
      storage_step: parsed.data.storage.step,
      version,
      updated_by: user.id,
      updated_at: nowIso(),
    };
    await table("pricing_rules", getDriver()).update(row.id as string, patch);
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "pricing.update",
      resource: "pricing_rules",
      resourceId: String(row.id),
      ip,
      metadata: { version, fields: Object.keys(patch) },
    });
    const updatedRow = await getLowPricingRulesRow();
    const rules = toRuleSet(updatedRow as never);
    const def = defaultLowConfig(rules);
    return Response.json({
      success: true,
      data: { rules, defaultPrice: calculateLowPrice(def, rules), version },
    });
  },
});
