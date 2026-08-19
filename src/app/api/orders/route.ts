import { api, fromZodError } from "@/lib/api/helpers";
import { z } from "zod";
import { createOrder } from "@/lib/store/orders";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { ApiError } from "@/lib/security";
import { sanitizeInput } from "@/lib/security";

const orderSchema = z.object({
  tierSlug: z.enum(["low", "medium", "high", "vps"]),
  cpu: z.number().int().optional(),
  ram: z.number().int().optional(),
  storage: z.number().int().optional(),
  packageId: z.string().uuid().nullable().optional(),
  vpsPackageId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1, "Nama wajib diisi.").max(100),
  whatsapp: z.string().trim().min(8, "Nomor WhatsApp tidak valid.").max(20),
  email: z.string().trim().toLowerCase().email("Email tidak valid."),
  serverName: z.string().trim().min(1, "Nama server wajib diisi.").max(100),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  couponCode: z.string().trim().max(50).optional().or(z.literal("")),
  accepted: z.literal(true, { errorMap: () => ({ message: "Anda harus menyetujui kebijakan sebelum memesan." }) }),
});

/**
 * POST /api/orders — alur lengkap:
 * payload limit → CSRF → Zod → sanitize → normalize → verify tier →
 * reject ongoing → verify package → verify coupon → hitung harga server-side →
 * transaction (order + item + coupon usage + audit) → WhatsApp URL.
 *
 * Harga dari client DIABAIKAN SEPENUHNYA.
 */
export const POST = api({
  methods: ["POST"],
  auth: "optional",
  rateLimit: { limit: RATE_LIMITS.order },
  handler: async ({ request, user, ip }) => {
    const raw = await request.text();
    if (raw.length > 200_000) {
      throw new ApiError("Ukuran payload melebihi batas.", "PAYLOAD_TOO_LARGE", 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      throw new ApiError("JSON tidak valid.", "INVALID_JSON", 400);
    }
    const parsed = orderSchema.safeParse(sanitizeInput(body));
    if (!parsed.success) throw fromZodError(parsed.error);
    const data = parsed.data;

    const result = await createOrder({
      tierSlug: data.tierSlug,
      cpu: data.cpu,
      ram: data.ram,
      storage: data.storage,
      packageId: data.packageId ?? null,
      vpsPackageId: data.vpsPackageId ?? null,
      customerName: data.name,
      customerWhatsapp: data.whatsapp,
      customerEmail: data.email,
      serverName: data.serverName,
      notes: data.notes ?? "",
      couponCode: data.couponCode || null,
      userId: user?.id ?? null,
      ip,
    });

    return Response.json({
      success: true,
      data: {
        orderId: result.order.id,
        orderNumber: result.order.order_number,
        status: result.order.status,
        total: result.order.total,
        discount: result.order.discount,
        priceRaw: result.order.price_raw,
        whatsappUrl: result.whatsappUrl,
        message: result.whatsappUrl
          ? "Pesanan berhasil dibuat. Konfirmasi melalui WhatsApp."
          : "Pesanan berhasil dibuat. Nomor WhatsApp belum dikonfigurasi — tim kami akan menghubungi Anda lewat email.",
      },
    });
  },
});
