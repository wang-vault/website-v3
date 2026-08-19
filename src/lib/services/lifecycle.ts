import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { daysBetween, isIsoSameOrBefore } from "@/lib/utils";
import type { ServiceInstance, ServiceStatus } from "@/lib/types";

/**
 * SERVICE LIFECYCLE — satu sumber kebenaran di server/database.
 * Waktu server/database adalah sumber kebenaran (bukan browser).
 */

/**
 * Hitung status layanan yang diturunkan dari waktu server:
 * - pending: belum dibuat aktif
 * - scheduled: activation_at di masa depan
 * - active: activation_at <= now DAN expires_at > now
 * - expired: expires_at <= now (kecuali suspended/cancelled/terminated)
 * Status manual (suspended/cancelled/terminated) dipertahankan.
 */
export function deriveServiceStatus(
  instance: Pick<ServiceInstance, "status" | "activation_at" | "expires_at">,
  now: Date = new Date(),
): ServiceStatus {
  if (instance.status === "suspended" || instance.status === "cancelled" || instance.status === "terminated") {
    return instance.status;
  }
  if (isIsoSameOrBefore(String(instance.expires_at), now.toISOString())) {
    return "expired";
  }
  if (isIsoSameOrBefore(String(instance.activation_at), now.toISOString())) {
    return "active";
  }
  return "scheduled";
}

/**
 * Sinkronkan status tersimpan dengan waktu server.
 * Dipanggil sebelum layanan ditampilkan/digunakan.
 */
export async function refreshServiceStatuses(now: Date = new Date()): Promise<number> {
  const driver = getDriver();
  const services = table<ServiceInstance>("service_instances", driver);
  const rows = await services.find({
    status: { op: "in", value: ["pending", "scheduled", "active", "expired"] },
  });
  let changed = 0;
  for (const row of rows) {
    const derived = deriveServiceStatus(row, now);
    if (derived !== row.status) {
      await services.update(row.id as string, { status: derived, updated_at: now.toISOString() });
      changed++;
    }
  }
  return changed;
}

export function statusLabel(status: ServiceStatus): string {
  switch (status) {
    case "pending":
      return "Menunggu";
    case "scheduled":
      return "Dijadwalkan";
    case "active":
      return "Aktif";
    case "suspended":
      return "Ditangguhkan";
    case "expired":
      return "Kedaluwarsa";
    case "cancelled":
      return "Dibatalkan";
    case "terminated":
      return "Dihentikan";
  }
}

export function remainingDays(expiresAtIso: string, now: Date = new Date()): number {
  return Math.max(0, daysBetween(now.toISOString(), expiresAtIso));
}
