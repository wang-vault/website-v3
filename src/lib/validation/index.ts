import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email tidak valid.")
  .max(254, "Email terlalu panjang.");

export const passwordSchema = z
  .string()
  .min(8, "Kata sandi minimal 8 karakter.")
  .max(128, "Kata sandi terlalu panjang.");

export const nameSchema = z.string().trim().min(1, "Nama wajib diisi.").max(100, "Nama terlalu panjang.");

export const whatsappSchema = z
  .string()
  .trim()
  .max(20, "Nomor WhatsApp terlalu panjang.")
  .refine((v) => /^[0-9+\-\s()]*$/.test(v), "Nomor WhatsApp tidak valid.");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: nameSchema,
  whatsapp: whatsappSchema.optional().or(z.literal("")),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Kata sandi wajib diisi.").max(128),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token wajib diisi."),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Kata sandi saat ini wajib diisi.").max(128),
  newPassword: passwordSchema,
});

export const profileSchema = z.object({
  fullName: nameSchema,
  whatsapp: whatsappSchema.optional().or(z.literal("")),
  discord: z.string().trim().max(200).optional().or(z.literal("")),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
});

export const savedConfigSchema = z.object({
  name: z.string().trim().min(1).max(100).optional().or(z.literal("")),
  tierSlug: z.enum(["low", "medium", "high"]),
  packageId: z.string().uuid("ID paket tidak valid.").nullable().optional(),
  cpu: z.number().int().optional(),
  ram: z.number().int().optional(),
  storage: z.number().int().optional(),
  price: z.number().int().optional(),
});

export const orderFormSchema = z.object({
  name: nameSchema,
  whatsapp: whatsappSchema,
  email: emailSchema,
  serverName: z.string().trim().min(1, "Nama server wajib diisi.").max(100),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  couponCode: z.string().trim().max(50).optional().or(z.literal("")),
  accepted: z.literal(true, { errorMap: () => ({ message: "Anda harus menyetujui kebijakan untuk melanjutkan." }) }),
});

export const ticketCreateSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  whatsapp: whatsappSchema.optional().or(z.literal("")),
  subject: z.string().trim().min(3, "Subjek minimal 3 karakter.").max(200),
  category: z.string().trim().min(1).max(100).default("Umum"),
  priority: z.enum(["rendah", "normal", "tinggi", "kritis"]).default("normal"),
  message: z.string().trim().min(10, "Pesan minimal 10 karakter.").max(5000),
});

export const ticketReplySchema = z.object({
  message: z.string().trim().min(1, "Pesan wajib diisi.").max(5000),
});

export const contactSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  whatsapp: whatsappSchema.optional().or(z.literal("")),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(5000),
});

export const couponValidateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  tierSlug: z.enum(["low", "medium", "high", "vps"]),
  price: z.number().int().min(0),
});

export const renewalSchema = z.object({
  durationDays: z.number().int().min(1).max(365),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
