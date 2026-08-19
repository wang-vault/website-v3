import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { addDaysIso, newId, nowIso, shortCode } from "@/lib/utils";
import type { Order, OrderItem, ServiceInstance, ServiceRenewal } from "@/lib/types";
import { ApiError } from "@/lib/security";
import { auditLog } from "@/lib/audit";
import { planRemindersForService } from "@/lib/services/reminders";
import { getSettings } from "@/lib/settings";
import { getServerPackageById, getVpsPackageById } from "@/lib/store/catalog";

/**
 * SERVICE CREATION — dipanggil saat pesanan dikonfirmasi (payment confirmed).
 * Layanan TIDAK otomatis active: mengikuti activation_at (server time).
 */
export async function createServiceForOrder(
  order: Order,
  item: OrderItem,
  opts?: { activationAt?: string; durationDays?: number; renewable?: boolean },
  actor?: { id: string; email: string } | null,
): Promise<ServiceInstance | null> {
  const driver = getDriver();
  const services = table<ServiceInstance>("service_instances", driver);

  const existing = await services.findOne({ order_id: order.id });
  if (existing) return existing;

  const now = nowIso();
  const settings = await getSettings();
  const durationDays = opts?.durationDays ?? 30;
  const activationAt = opts?.activationAt ?? now;
  const renewable = opts?.renewable ?? true;
  const serviceType = item.product_type;

  const service: ServiceInstance = {
    id: newId(),
    service_number: await generateServiceNumber(driver),
    customer_id: order.user_id ?? "",
    order_id: order.id,
    product_id: item.product_id ?? null,
    package_id: item.package_id ?? null,
    service_type: serviceType,
    name: order.server_name || item.product_name,
    status: "pending",
    activation_at: activationAt,
    expires_at: addDaysIso(activationAt, durationDays),
    renewable,
    price: order.total,
    created_at: now,
    updated_at: now,
  };

  if (!service.customer_id) {
    // Pesanan tanpa akun: layanan membutuhkan pelanggan. Buat "anonim"? Tidak —
    // layanan hanya dibuat untuk pesanan milik akun. Dikembalikan null.
    return null;
  }

  const created = await services.insert(service);

  // Rencanakan reminder default (idempotent).
  const intervals = settings.reminderIntervals.length ? settings.reminderIntervals : [7, 3, 1];
  await planRemindersForService(created, intervals);
  await planRemindersForService(created, [0], new Date(created.expires_at));

  await auditLog({
    actorType: actor ? "user" : "system",
    actorId: actor?.id ?? null,
    actorEmail: actor?.email ?? null,
    action: "create",
    resource: "service",
    resourceId: service.id,
    metadata: { serviceNumber: service.service_number, orderNumber: order.order_number, activationAt, durationDays },
  });

  // Notifikasi pelanggan
  if (order.user_id) {
    await table("notifications", driver).insert({
      id: newId(),
      user_id: order.user_id,
      type: "service_created",
      title: "Layanan dibuat",
      message: `Layanan "${service.name}" telah dibuat. Aktivasi: ${new Date(activationAt).toLocaleString("id-ID")}.`,
      link: "/dashboard/services",
      read_at: null,
      created_at: now,
    });
  }
  return created;
}

async function generateServiceNumber(driver: ReturnType<typeof getDriver>): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = shortCode("SVC", 8);
    const exists = await table("service_instances", driver).findOne({ service_number: candidate });
    if (!exists) return candidate;
  }
  throw new ApiError("Gagal membuat nomor layanan.", "SERVICE_NUMBER_FAILED", 500);
}

/**
 * RENEWAL — buat order renewal + service_renewals.
 * - Layanan aktif  → new_expires_at = expires_at saat ini + durasi
 * - Layanan expired → masa baru mulai dari waktu server saat disetujui
 * - Harga dihitung server-side dari paket yang berlaku
 */
export async function createRenewalOrder(input: {
  service: ServiceInstance;
  durationDays: number;
  customer: { id: string; name: string; whatsapp: string; email: string };
  ip?: string | null;
}): Promise<{ order: Order; renewal: ServiceRenewal }> {
  const driver = getDriver();
  const service = input.service;
  const settings = await getSettings();

  if (!service.renewable) {
    throw new ApiError("Layanan ini tidak dapat diperpanjang.", "RENEWAL_NOT_ALLOWED", 403);
  }
  if (["cancelled", "terminated"].includes(service.status)) {
    throw new ApiError("Layanan sudah tidak dapat diperpanjang.", "RENEWAL_NOT_ALLOWED", 403);
  }
  if (input.durationDays < 1 || input.durationDays > 365) {
    throw new ApiError("Durasi perpanjangan tidak valid.", "RENEWAL_DURATION_INVALID", 400);
  }

  // Paket harus masih valid & orderable
  let price = service.price;
  let packageName = null;
  if (service.service_type === "server_builder" && service.package_id) {
    const pkg = await getServerPackageById(String(service.package_id));
    if (pkg && pkg.status === "available" && pkg.orderable && !pkg.archived_at) {
      price = pkg.price;
      packageName = pkg.name;
    } else if (!pkg) {
      throw new ApiError("Paket layanan tidak ditemukan.", "RENEWAL_PACKAGE_INVALID", 409);
    }
  } else if (service.service_type === "vps" && service.package_id) {
    const pkg = await getVpsPackageById(String(service.package_id));
    if (pkg && pkg.status === "available" && pkg.visible && !pkg.archived_at) {
      price = pkg.price;
      packageName = pkg.name;
    } else if (!pkg) {
      throw new ApiError("Paket VPS tidak ditemukan.", "RENEWAL_PACKAGE_INVALID", 409);
    }
  }

  const now = nowIso();
  const orderNumber = await generateRenewalOrderNumber(driver);
  const orderId = newId();

  const order: Order = {
    id: orderId,
    order_number: orderNumber,
    user_id: input.customer.id,
    customer_name: input.customer.name,
    customer_whatsapp: input.customer.whatsapp,
    customer_email: input.customer.email,
    server_name: service.name,
    notes: `Perpanjangan layanan ${service.service_number} selama ${input.durationDays} hari.`,
    tier_slug: service.service_type === "vps" ? "high" : "low",
    tier_name: service.service_type === "vps" ? "VPS" : "Perpanjangan",
    package_id: service.package_id,
    package_name: packageName,
    cpu: 0,
    ram: 0,
    storage: 0,
    price_raw: price,
    discount: 0,
    total: price,
    coupon_code: null,
    status: "awaiting_payment",
    payment_provider: "manual",
    currency: "IDR",
    whatsapp_number: settings.whatsappNumber,
    source: "renewal",
    created_at: now,
    updated_at: now,
    confirmed_at: null,
    cancelled_at: null,
  };

  const renewal: ServiceRenewal = {
    id: newId(),
    service_id: service.id,
    order_id: orderId,
    duration_days: input.durationDays,
    old_expires_at: service.expires_at,
    new_expires_at: "",
    price,
    status: "pending",
    created_at: now,
    completed_at: null,
  };

  await driver.tx(async (tx) => {
    await table<Order>("orders", tx).insert(order);
    await table<ServiceRenewal>("service_renewals", tx).insert(renewal);
  });

  await auditLog({
    actorType: "user",
    actorId: input.customer.id,
    action: "create",
    resource: "service_renewal",
    resourceId: renewal.id,
    ip: input.ip ?? null,
    metadata: { serviceId: service.id, orderNumber, durationDays: input.durationDays, price },
  });

  return { order, renewal };
}

async function generateRenewalOrderNumber(driver: ReturnType<typeof getDriver>): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = shortCode("RNW", 8);
    const exists = await table("orders", driver).findOne({ order_number: candidate });
    if (!exists) return candidate;
  }
  throw new ApiError("Gagal membuat nomor perpanjangan.", "ORDER_NUMBER_FAILED", 500);
}

/**
 * Konfirmasi pembayaran renewal → perpanjang expires_at (server time).
 * - aktif: old expires_at + durasi
 * - expired: server time sekarang + durasi
 */
export async function confirmRenewalOrder(order: Order, actor?: { id: string; email: string } | null): Promise<ServiceInstance | null> {
  const driver = getDriver();
  const renewal = await table<ServiceRenewal>("service_renewals", driver).findOne({ order_id: order.id });
  if (!renewal) return null;
  if (renewal.status !== "pending") return renewal.status === "completed" ? null : null;

  const service = await table<ServiceInstance>("service_instances", driver).findById(String(renewal.service_id));
  if (!service) throw new ApiError("Layanan tidak ditemukan.", "SERVICE_NOT_FOUND", 404);

  const now = new Date();
  const isExpired = new Date(String(service.expires_at)).getTime() <= now.getTime();
  const base = isExpired ? now : new Date(String(service.expires_at));
  const newExpiresAt = addDaysIso(base, renewal.duration_days);
  const oldExpiresAt = service.expires_at;

  await driver.tx(async (tx) => {
    await table<ServiceInstance>("service_instances", tx).update(service.id as string, {
      expires_at: newExpiresAt,
      status: "active",
      updated_at: nowIso(),
    });
    await table<ServiceRenewal>("service_renewals", tx).update(renewal.id as string, {
      status: "completed",
      new_expires_at: newExpiresAt,
      completed_at: nowIso(),
    });
    await table<Order>("orders", tx).update(order.id, { status: "completed", confirmed_at: nowIso(), updated_at: nowIso() });
    await table("notifications", tx).insert({
      id: newId(),
      user_id: service.customer_id,
      type: "service_renewed",
      title: "Layanan diperpanjang",
      message: `Layanan "${service.name}" diperpanjang hingga ${new Date(newExpiresAt).toLocaleString("id-ID")}.`,
      link: "/dashboard/services",
      read_at: null,
      created_at: nowIso(),
    });
  });

  await auditLog({
    actorType: actor ? "user" : "system",
    actorId: actor?.id ?? null,
    actorEmail: actor?.email ?? null,
    action: "renewal.confirm",
    resource: "service",
    resourceId: service.id,
    metadata: { renewalId: renewal.id, oldExpiresAt, newExpiresAt, durationDays: renewal.duration_days },
  });
  return { ...service, expires_at: newExpiresAt, status: "active" };
}

/** Manual extension oleh admin (diizinkan sesuai permission), wajib audit. */
export async function manualExtendService(input: {
  service: ServiceInstance;
  newExpiresAt: string;
  reason: string;
  actor: { id: string; email: string };
}): Promise<ServiceInstance> {
  const driver = getDriver();
  const now = new Date();
  if (new Date(input.newExpiresAt).getTime() <= now.getTime()) {
    throw new ApiError("Waktu kedaluwarsa baru harus di masa depan.", "INVALID_EXPIRY", 400);
  }
  const oldActivation = input.service.activation_at;
  const oldExpires = input.service.expires_at;
  const updated = await table<ServiceInstance>("service_instances", driver).update(input.service.id as string, {
    expires_at: input.newExpiresAt,
    status: new Date(input.service.activation_at).getTime() <= now.getTime() ? "active" : "scheduled",
    updated_at: nowIso(),
  });
  if (!updated) throw new ApiError("Layanan tidak ditemukan.", "SERVICE_NOT_FOUND", 404);
  await auditLog({
    actorType: "user",
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    action: "service.extend_manual",
    resource: "service",
    resourceId: input.service.id,
    metadata: {
      reason: input.reason,
      previousActivation: oldActivation,
      previousExpiration: oldExpires,
      newActivation: input.service.activation_at,
      newExpiration: input.newExpiresAt,
    },
  });
  return updated;
}
