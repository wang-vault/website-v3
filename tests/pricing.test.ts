import { describe, expect, it } from "vitest";
import {
  ABSOLUTE_SAFETY_LIMITS,
  calculateLowPrice,
  estimatePerformance,
  normalizeLowConfig,
  toRuleSet,
  type PricingRuleSet,
} from "@/lib/pricing";
import type { LowPricingRules } from "@/lib/types";

const RULES_ROW: LowPricingRules = {
  id: "r1",
  tier_id: "t1",
  base: 5000,
  per_core: 4000,
  per_gb_ram: 3000,
  per_gb_storage: 1000,
  min_price: 50000,
  max_price: null,
  rounding: 500,
  cpu_min: 2,
  cpu_max: 16,
  cpu_step: 1,
  ram_min: 4,
  ram_max: 32,
  ram_step: 2,
  storage_min: 20,
  storage_max: 160,
  storage_step: 10,
  version: 1,
  updated_by: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const RULES: PricingRuleSet = toRuleSet(RULES_ROW);

describe("pricing: formula Tier Low", () => {
  it("konfigurasi minimum 2 core / 4 GB / 20 GB → Rp45.000 raw → final Rp50.000 (minimum price)", () => {
    const p = calculateLowPrice({ cpu: 2, ram: 4, storage: 20 }, RULES);
    // base 5000 + 2*4000 + 4*3000 + 20*1000 = 5000+8000+12000+20000 = 45000
    expect(p.subtotal).toBe(45000);
    // dibulatkan ke 500 → 45000, tapi minimum 50000
    expect(p.total).toBe(50000);
  });

  it("perhitungan menengah: 4 core / 8 GB / 40 GB", () => {
    const p = calculateLowPrice({ cpu: 4, ram: 8, storage: 40 }, RULES);
    // 5000 + 16000 + 24000 + 40000 = 85000
    expect(p.subtotal).toBe(85000);
    expect(p.total).toBe(85000);
  });

  it("pembulatan ke kelipatan Rp500", () => {
    const p = calculateLowPrice({ cpu: 3, ram: 6, storage: 35 }, RULES);
    // 5000 + 12000 + 18000 + 35000 = 70000 → 70000 (sudah kelipatan 500)
    expect(p.total % 500).toBe(0);
  });

  it("harga tidak pernah di bawah minimum", () => {
    const p = calculateLowPrice({ cpu: 2, ram: 4, storage: 20 }, RULES);
    expect(p.total).toBeGreaterThanOrEqual(RULES.minPrice);
  });

  it("max price diterapkan bila dikonfigurasi", () => {
    const rulesWithMax: PricingRuleSet = { ...RULES, maxPrice: 60000 };
    const p = calculateLowPrice({ cpu: 16, ram: 32, storage: 160 }, rulesWithMax);
    expect(p.total).toBe(60000);
  });
});

describe("pricing: normalisasi konfigurasi Low (sumber kebenaran server)", () => {
  it("overflow 20 core / 64 GB / 900 GB → 16 / 32 / 160 (safety limit)", () => {
    const n = normalizeLowConfig({ cpu: 20, ram: 64, storage: 900 }, RULES);
    expect(n.cpu).toBe(16);
    expect(n.ram).toBe(32);
    expect(n.storage).toBe(160);
  });

  it("nilai non-angka → minimum", () => {
    const n = normalizeLowConfig({ cpu: Number.NaN, ram: -5, storage: 0 } as never, RULES);
    expect(n.cpu).toBe(2);
    expect(n.ram).toBe(4);
    expect(n.storage).toBe(20);
  });

  it("snap ke step", () => {
    // ram step 2: 5 → 4; storage step 10: 25 → 20
    const n = normalizeLowConfig({ cpu: 2, ram: 5, storage: 25 }, RULES);
    expect(n.ram).toBe(4);
    expect(n.storage).toBe(20);
  });

  it("nilai dalam rentang tetap dipertahankan", () => {
    const n = normalizeLowConfig({ cpu: 8, ram: 16, storage: 100 }, RULES);
    expect(n.cpu).toBe(8);
    expect(n.ram).toBe(16);
    expect(n.storage).toBe(100);
  });

  it("safety limit absolut tidak dapat dilewati walau aturan DB diubah", () => {
    const weirdRules: PricingRuleSet = { ...RULES, cpu: { min: 1, max: 64, step: 1 } };
    const n = normalizeLowConfig({ cpu: 100, ram: 100, storage: 1000 }, weirdRules);
    expect(n.cpu).toBeLessThanOrEqual(ABSOLUTE_SAFETY_LIMITS.cpu.max);
    expect(n.ram).toBeLessThanOrEqual(ABSOLUTE_SAFETY_LIMITS.ram.max);
    expect(n.storage).toBeLessThanOrEqual(ABSOLUTE_SAFETY_LIMITS.storage.max);
  });
});

describe("pricing: estimasi performa (deterministik & shared)", () => {
  it("menghasilkan angka dalam rentang wajar", () => {
    const e = estimatePerformance({ cpu: 4, ram: 8, storage: 40 }, 1);
    expect(e.estTps).toBeGreaterThanOrEqual(10);
    expect(e.estTps).toBeLessThanOrEqual(20);
    expect(e.estPlayers).toBeGreaterThan(0);
    expect(e.estCpuLoad).toBeGreaterThanOrEqual(5);
    expect(e.estCpuLoad).toBeLessThanOrEqual(95);
    expect(e.recommendedPlugins).toBeGreaterThan(0);
    expect(["Standard", "Medium", "High"]).toContain(e.grade);
  });

  it("perfFactor tier memengaruhi hasil (deterministik)", () => {
    const base = estimatePerformance({ cpu: 4, ram: 8, storage: 40 }, 1);
    const boosted = estimatePerformance({ cpu: 4, ram: 8, storage: 40 }, 1.3);
    expect(boosted.estPlayers).toBeGreaterThanOrEqual(base.estPlayers);
  });
});
