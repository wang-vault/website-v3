import { z } from "zod";

export const serverPackageSchema = z.object({
  tierSlug: z.enum(["medium", "high"]),
  name: z.string().trim().min(2, "Nama paket minimal 2 karakter.").max(100),
  cpu: z.number().int().min(1).max(64),
  ram: z.number().int().min(1).max(256),
  storage: z.number().int().min(5).max(2000),
  price: z.number().int().min(0),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  status: z.enum(["available", "maintenance", "sold_out", "inactive"]),
  visible: z.boolean().default(true),
  orderable: z.boolean().default(true),
  popular: z.boolean().default(false),
  popularLabel: z.string().trim().max(50).optional().or(z.literal("")),
  performanceFactor: z.number().min(0.5).max(2).optional().default(1),
});

export const vpsPackageSchema = z.object({
  name: z.string().trim().min(2).max(100),
  cpu: z.number().int().min(1).max(64),
  ram: z.number().int().min(1).max(256),
  storage: z.number().int().min(5).max(20000),
  bandwidth: z.string().trim().max(50).optional().or(z.literal("")),
  ipv4Available: z.boolean().default(true),
  locationId: z.string().uuid().nullable().optional(),
  virtualization: z.string().trim().max(30).optional().or(z.literal("")),
  price: z.number().int().min(0),
  billingPeriod: z.string().trim().max(30).optional().or(z.literal("monthly")),
  renewable: z.boolean().default(true),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  features: z.array(z.string().trim().max(200)).max(30).optional().default([]),
  status: z.enum(["available", "maintenance", "sold_out", "inactive"]),
  visible: z.boolean().default(true),
  stock: z.number().int().min(0).nullable().optional(),
});

export const locationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  country: z.string().trim().max(100).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const pricingRulesSchema = z
  .object({
    base: z.number().int().min(0),
    perCore: z.number().int().min(0),
    perGbRam: z.number().int().min(0),
    perGbStorage: z.number().int().min(0),
    minPrice: z.number().int().min(0),
    maxPrice: z.number().int().min(0).nullable().optional(),
    rounding: z.number().int().min(1).max(10000),
    cpu: z.object({ min: z.number().int().min(1), max: z.number().int().min(1), step: z.number().int().min(1) }),
    ram: z.object({ min: z.number().int().min(1), max: z.number().int().min(1), step: z.number().int().min(1) }),
    storage: z.object({ min: z.number().int().min(1), max: z.number().int().min(1), step: z.number().int().min(1) }),
  })
  .refine((v) => v.cpu.min <= v.cpu.max && v.ram.min <= v.ram.max && v.storage.min <= v.storage.max, {
    message: "Nilai minimum tidak boleh melebihi maksimum.",
    path: ["limits"],
  });

export const couponSchema = z.object({
  code: z.string().trim().min(2).max(50).transform((v) => v.toUpperCase()),
  type: z.enum(["percentage", "fixed"]),
  value: z.number().int().min(1).max(100_000_000),
  minOrder: z.number().int().min(0).default(0),
  maxUsage: z.number().int().min(1).nullable().optional(),
  usagePerCustomer: z.number().int().min(1).nullable().optional(),
  startsAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  active: z.boolean().default(true),
  applicableTiers: z.array(z.enum(["low", "medium", "high", "vps"])).nullable().optional(),
  applicableProductTypes: z.array(z.enum(["server_builder", "vps"])).nullable().optional(),
});

export const orderStatusSchema = z.object({
  status: z.enum(["pending", "awaiting_payment", "paid", "processing", "completed", "cancelled", "expired", "refunded"]),
  activationAt: z.string().nullable().optional(),
  durationDays: z.number().int().min(1).max(365).optional(),
  renewable: z.boolean().optional(),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const servicePatchSchema = z.object({
  status: z.enum(["pending", "scheduled", "active", "suspended", "expired", "cancelled", "terminated"]).optional(),
  activationAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  renewable: z.boolean().optional(),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const userPatchSchema = z.object({
  roleSlug: z.enum(["owner", "admin", "staff", "customer"]).optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

export const settingsPatchSchema = z.object({
  siteName: z.string().trim().min(1).max(100).optional(),
  siteTagline: z.string().trim().max(200).optional(),
  siteDescription: z.string().trim().max(500).optional(),
  seoTitle: z.string().trim().max(200).optional(),
  seoDescription: z.string().trim().max(500).optional(),
  whatsappNumber: z.string().trim().max(20).optional(),
  discordUrl: z.string().trim().max(500).optional(),
  emailPublic: z.string().trim().max(200).optional(),
  contactNote: z.string().trim().max(500).optional(),
  maintenanceEnabled: z.boolean().optional(),
  maintenanceTitle: z.string().trim().max(200).optional(),
  maintenanceMessage: z.string().trim().max(1000).optional(),
  maintenanceUntil: z.string().trim().max(50).optional(),
  maintenanceAllowedPaths: z.array(z.string().max(200)).max(20).optional(),
  remindersEnabled: z.boolean().optional(),
  reminderIntervals: z.array(z.number().int().min(0).max(90)).max(10).optional(),
});

export const incidentSchema = z.object({
  title: z.string().trim().min(2).max(200),
  messageMd: z.string().trim().max(5000).optional().or(z.literal("")),
  severity: z.enum(["degraded", "major"]),
  status: z.enum(["investigating", "identified", "monitoring", "resolved"]),
  startedAt: z.string().optional(),
  resolvedAt: z.string().nullable().optional(),
});

export const maintenanceWindowSchema = z.object({
  title: z.string().trim().min(2).max(200),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  status: z.enum(["scheduled", "active", "completed", "cancelled"]).optional(),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(2).max(200),
  messageMd: z.string().trim().max(5000).optional().or(z.literal("")),
  status: z.enum(["draft", "active"]),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
});

export const faqSchema = z.object({
  question: z.string().trim().min(3).max(500),
  answerMd: z.string().trim().min(3).max(5000),
  category: z.string().trim().max(100).default("Umum"),
  sort: z.number().int().default(0),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const testimonialSchema = z.object({
  name: z.string().trim().min(2).max(100),
  role: z.string().trim().max(200).optional().or(z.literal("")),
  content: z.string().trim().min(3).max(3000),
  rating: z.number().int().min(1).max(5).default(5),
  status: z.enum(["pending", "published"]).default("pending"),
});

export const blogPostSchema = z.object({
  title: z.string().trim().min(2).max(300),
  slug: z.string().trim().min(1).max(200).optional(),
  excerpt: z.string().trim().max(500).optional().or(z.literal("")),
  contentMd: z.string().trim().min(10).max(100_000),
  categoryId: z.string().uuid().nullable().optional(),
  authorName: z.string().trim().max(100).optional(),
  status: z.enum(["draft", "published"]),
  publishedAt: z.string().nullable().optional(),
  seoTitle: z.string().trim().max(200).optional().or(z.literal("")),
  seoDescription: z.string().trim().max(500).optional().or(z.literal("")),
  tags: z.array(z.string().trim().max(50)).max(10).optional().default([]),
});

export const kbArticleSchema = z.object({
  title: z.string().trim().min(2).max(300),
  slug: z.string().trim().min(1).max(200).optional(),
  excerpt: z.string().trim().max(500).optional().or(z.literal("")),
  contentMd: z.string().trim().min(10).max(100_000),
  category: z.string().trim().min(1).max(100),
  authorName: z.string().trim().max(100).optional(),
  status: z.enum(["draft", "published"]),
  publishedAt: z.string().nullable().optional(),
  seoTitle: z.string().trim().max(200).optional().or(z.literal("")),
  seoDescription: z.string().trim().max(500).optional().or(z.literal("")),
});

export const pageSchema = z.object({
  slug: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  seoTitle: z.string().trim().max(200).optional().or(z.literal("")),
  seoDescription: z.string().trim().max(500).optional().or(z.literal("")),
  sections: z
    .array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("hero"), title: z.string().max(200), subtitle: z.string().max(500), ctaLabel: z.string().max(50).optional(), ctaHref: z.string().max(300).optional(), ctaSecondaryLabel: z.string().max(50).optional(), ctaSecondaryHref: z.string().max(300).optional() }),
        z.object({ type: z.literal("heading"), text: z.string().max(300) }),
        z.object({ type: z.literal("paragraph"), text: z.string().max(10_000) }),
        z.object({ type: z.literal("list"), title: z.string().max(200).optional(), items: z.array(z.string().max(1000)).max(30) }),
        z.object({ type: z.literal("cta"), title: z.string().max(200), description: z.string().max(500), label: z.string().max(50), href: z.string().max(300) }),
        z.object({ type: z.literal("card"), title: z.string().max(200), description: z.string().max(1000) }),
      ]),
    )
    .max(50),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const legalDocumentSchema = z.object({
  slug: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  sections: z
    .array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("heading"), text: z.string().max(300) }),
        z.object({ type: z.literal("paragraph"), text: z.string().max(10_000) }),
      ]),
    )
    .max(100),
});

export const rolePermissionSchema = z.object({
  roleSlug: z.enum(["admin", "staff"]),
  permissions: z.array(z.string().min(1)),
});
