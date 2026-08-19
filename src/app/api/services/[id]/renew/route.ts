import { api, fromZodError } from "@/lib/api/helpers";
import { renewalSchema } from "@/lib/validation";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { createRenewalOrder } from "@/lib/store/services";
import { refreshServiceStatuses } from "@/lib/services/lifecycle";
import { buildOrderWhatsAppMessage, waMeUrl } from "@/lib/whatsapp";
import { getSettings } from "@/lib/settings";
import { ApiError } from "@/lib/security";
import { RATE_LIMITS } from "@/lib/rate-limit";
import type { Order, Profile, ServiceInstance, User } from "@/lib/types";

/**
 * POST /api/services/[id]/renew — perpanjangan layanan.
 * Server memverifikasi: kepemilikan, status, renewable, paket valid,
 * lalu menghitung harga server-side dan membuat renewal order.
 */
export const POST = api({
  methods: ["POST"],
  auth: "required",
  rateLimit: { limit: RATE_LIMITS.order },
  handler: async ({ request, params, user, ip }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = renewalSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);

    await refreshServiceStatuses();
    const driver = getDriver();
    const service = await table<ServiceInstance>("service_instances", driver).findById(params.id);
    if (!service) throw new ApiError("Layanan tidak ditemukan.", "SERVICE_NOT_FOUND", 404);
    if (String(service.customer_id) !== user.id) {
      throw new ApiError("Akses ditolak.", "FORBIDDEN", 403);
    }
    if (["cancelled", "terminated"].includes(String(service.status))) {
      throw new ApiError("Layanan sudah tidak dapat diperpanjang.", "RENEWAL_NOT_ALLOWED", 403);
    }
    if (!service.renewable) {
      throw new ApiError("Layanan ini tidak dapat diperpanjang.", "RENEWAL_NOT_ALLOWED", 403);
    }

    const profile = await table<Profile>("profiles", driver).findOne({ user_id: user.id });
    const userRow = await table<User>("users", driver).findById(user.id);
    if (!userRow) throw new ApiError("Akun tidak ditemukan.", "NOT_FOUND", 404);

    const result = await createRenewalOrder({
      service,
      durationDays: parsed.data.durationDays,
      customer: {
        id: user.id,
        name: profile?.full_name || user.email,
        whatsapp: profile?.whatsapp || "",
        email: user.email,
      },
      ip,
    });

    const settings = await getSettings();
    const orderRow: Order = result.order;
    const whatsappUrl = settings.whatsappNumber ? waMeUrl(settings.whatsappNumber, buildOrderWhatsAppMessage(orderRow)) : null;

    return Response.json({
      success: true,
      data: {
        order: { id: result.order.id, orderNumber: result.order.order_number, status: result.order.status, total: result.order.total },
        renewal: { id: result.renewal.id, durationDays: result.renewal.duration_days, price: result.renewal.price },
        whatsappUrl,
      },
    });
  },
});
