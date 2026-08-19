import type { LowPricingRules, ServerPackage, ServerTier, VpsPackage } from "@/lib/types";
import { clamp, snapToStep } from "@/lib/utils/format";

/**
 * PRICING ENGINE — SATU-SATUNYA SUMBER KEBENARAN HARGA.
 * Dipakai bersama oleh UI (Server Builder) dan API (order).
 * Dilarang membuat formula harga terpisah antara client dan server.
 */

/** Batas keamanan absolut server. Client tidak boleh melewatinya. */
export const ABSOLUTE_SAFETY_LIMITS = {
  cpu: { min: 1, max: 16, step: 1 },
  ram: { min: 1, max: 32, step: 1 },
  storage: { min: 5, max: 160, step: 1 },
} as const;

export interface LowConfig {
  cpu: number;
  ram: number;
  storage: number;
}

export interface PriceBreakdown {
  base: number;
  cpuCost: number;
  ramCost: number;
  storageCost: number;
  subtotal: number;
  rounded: number;
  minPrice: number;
  maxPrice: number | null;
  total: number;
}

export interface NormalizedLowConfig extends LowConfig {
  original: LowConfig;
}

/** Struktur aturan yang ramah untuk dipakai modul (di-mapping dari row DB). */
export interface PricingRuleSet {
  base: number;
  perCore: number;
  perGbRam: number;
  perGbStorage: number;
  minPrice: number;
  maxPrice: number | null;
  rounding: number;
  cpu: { min: number; max: number; step: number };
  ram: { min: number; max: number; step: number };
  storage: { min: number; max: number; step: number };
}

export function toRuleSet(rules: LowPricingRules): PricingRuleSet {
  return {
    base: rules.base,
    perCore: rules.per_core,
    perGbRam: rules.per_gb_ram,
    perGbStorage: rules.per_gb_storage,
    minPrice: rules.min_price,
    maxPrice: rules.max_price,
    rounding: rules.rounding,
    cpu: { min: rules.cpu_min, max: rules.cpu_max, step: rules.cpu_step },
    ram: { min: rules.ram_min, max: rules.ram_max, step: rules.ram_step },
    storage: { min: rules.storage_min, max: rules.storage_max, step: rules.storage_step },
  };
}

/**
 * Normalisasi konfigurasi Low:
 * 1. Nilai non-angka diabaikan (default minimum).
 * 2. Dipangkas ke batas keamanan absolut server.
 * 3. Dijepit ke rentang aturan DB, lalu di-snap ke step.
 */
export function normalizeLowConfig(config: Partial<LowConfig> | null | undefined, rules: PricingRuleSet): NormalizedLowConfig {
  const original: LowConfig = {
    cpu: typeof config?.cpu === "number" && Number.isFinite(config.cpu) ? config.cpu : rules.cpu.min,
    ram: typeof config?.ram === "number" && Number.isFinite(config.ram) ? config.ram : rules.ram.min,
    storage:
      typeof config?.storage === "number" && Number.isFinite(config.storage) ? config.storage : rules.storage.min,
  };
  // Safety limit absolut (tidak dapat dilewati client walau aturan DB diubah).
  const safe = {
    cpu: Math.floor(clamp(original.cpu, ABSOLUTE_SAFETY_LIMITS.cpu.min, ABSOLUTE_SAFETY_LIMITS.cpu.max)),
    ram: Math.floor(clamp(original.ram, ABSOLUTE_SAFETY_LIMITS.ram.min, ABSOLUTE_SAFETY_LIMITS.ram.max)),
    storage: Math.floor(clamp(original.storage, ABSOLUTE_SAFETY_LIMITS.storage.min, ABSOLUTE_SAFETY_LIMITS.storage.max)),
  };
  // Batas aturan DB (editable oleh admin), dengan step.
  return {
    cpu: snapToStep(safe.cpu, rules.cpu.min, rules.cpu.step, rules.cpu.max),
    ram: snapToStep(safe.ram, rules.ram.min, rules.ram.step, rules.ram.max),
    storage: snapToStep(safe.storage, rules.storage.min, rules.storage.step, rules.storage.max),
    original,
  };
}

function roundTo(value: number, rounding: number): number {
  if (rounding <= 0) return Math.round(value);
  return Math.round(value / rounding) * rounding;
}

/**
 * Formula harga Tier Low:
 *   base + (CPU × perCore) + (RAM × perGbRam) + (Storage × perGbStorage)
 * dibulatkan ke kelipatan `rounding`, lalu dijepit ke harga minimum (dan maksimum bila ada).
 *
 * Nilai default: 2 core / 4 GB / 20 GB → raw Rp45.000 → final Rp50.000 (minimum price).
 */
export function calculateLowPrice(config: LowConfig, rules: PricingRuleSet): PriceBreakdown {
  const base = Math.max(0, rules.base);
  const cpuCost = Math.max(0, config.cpu) * Math.max(0, rules.perCore);
  const ramCost = Math.max(0, config.ram) * Math.max(0, rules.perGbRam);
  const storageCost = Math.max(0, config.storage) * Math.max(0, rules.perGbStorage);
  const subtotal = base + cpuCost + ramCost + storageCost;
  const rounded = roundTo(subtotal, rules.rounding);
  const minPrice = Math.max(0, rules.minPrice);
  const maxPrice = rules.maxPrice !== null && rules.maxPrice !== undefined ? Math.max(0, rules.maxPrice) : null;
  let total = Math.max(minPrice, rounded);
  if (maxPrice !== null) total = Math.min(maxPrice, total);
  return { base, cpuCost, ramCost, storageCost, subtotal, rounded, minPrice, maxPrice, total };
}

/** Harga final untuk Tier package (Medium/High) dan VPS — dari database. */
export function packagePrice(pkg: ServerPackage | VpsPackage): number {
  return Math.max(0, Math.round(pkg.price));
}

export interface OrderPriceResult {
  priceRaw: number;
  discount: number;
  total: number;
  breakdown: PriceBreakdown | null;
}

/**
 * Hitung harga pesanan secara server-side.
 * - low → formula Low
 * - medium/high → harga paket dari database
 * - vps → harga paket VPS dari database
 * Mengembalikan null untuk tier tak dikenal (harus ditolak oleh pemanggil).
 */
export function calculateOrderPrice(input: {
  tierSlug: string | null;
  config?: LowConfig;
  rules?: PricingRuleSet;
  serverPackage?: ServerPackage | null;
  vpsPackage?: VpsPackage | null;
}): OrderPriceResult | null {
  if (input.tierSlug === "low") {
    if (!input.rules) return null;
    const normalized = normalizeLowConfig(input.config, input.rules);
    const breakdown = calculateLowPrice(normalized, input.rules);
    return { priceRaw: breakdown.total, discount: 0, total: breakdown.total, breakdown };
  }
  if (input.tierSlug === "medium" || input.tierSlug === "high") {
    if (!input.serverPackage) return null;
    const price = packagePrice(input.serverPackage);
    return { priceRaw: price, discount: 0, total: price, breakdown: null };
  }
  if (input.tierSlug === "vps") {
    if (!input.vpsPackage) return null;
    const price = packagePrice(input.vpsPackage);
    return { priceRaw: price, discount: 0, total: price, breakdown: null };
  }
  return null;
}

/**
 * Estimasi performa — DETERMINISTIK & SHARED (UI + API).
 * Hanya memakai data konfigurasi yang tersedia (CPU, RAM, storage, perfFactor tier).
 * Semua angka wajib diberi label "Estimasi" di UI.
 */
export interface PerformanceEstimate {
  estTps: number;
  estPlayers: number;
  estCpuLoad: number;
  estRamUsage: number;
  recommendedPlugins: number;
  grade: "Standard" | "Medium" | "High";
}

export function estimatePerformance(config: LowConfig, performanceFactor: number): PerformanceEstimate {
  const pf = Math.max(0.5, Math.min(2, performanceFactor));
  const cpu = Math.max(1, config.cpu);
  const ram = Math.max(1, config.ram);
  const storage = Math.max(1, config.storage);

  const estTps = Math.round((cpu * 22 + ram * 2.5) * pf);
  const estPlayers = Math.round((cpu * 9 + ram * 3.5) * pf);
  const estCpuLoad = clamp(Math.round(92 - cpu * 3.5 - ram * 1.5), 5, 95);
  const estRamUsage = clamp(Math.round(88 - ram * 1.8), 5, 95);
  const recommendedPlugins = clamp(Math.round(cpu * 2.5 + ram * 1.2), 3, 120);

  const score = cpu * 1.5 + ram * 1.2 + storage * 0.1;
  const grade: PerformanceEstimate["grade"] =
    score >= 55 ? "High" : score >= 30 ? "Medium" : "Standard";

  return {
    estTps: Math.min(20, estTps),
    estPlayers,
    estCpuLoad,
    estRamUsage,
    recommendedPlugins,
    grade,
  };
}

/** Grade build dalam Bahasa Indonesia. */
export function gradeLabel(grade: PerformanceEstimate["grade"]): string {
  switch (grade) {
    case "High":
      return "Tinggi";
    case "Medium":
      return "Menengah";
    default:
      return "Standar";
  }
}

/** Default konfigurasi Low (sumber: aturan DB). */
export function defaultLowConfig(rules: PricingRuleSet): LowConfig {
  return { cpu: rules.cpu.min, ram: rules.ram.min, storage: rules.storage.min };
}

export function tierPerformanceFactor(tier: Pick<ServerTier, "performance_factor"> | null | undefined): number {
  return typeof tier?.performance_factor === "number" ? tier.performance_factor : 1;
}
