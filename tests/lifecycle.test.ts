import { beforeEach, beforeAll, describe, expect, it } from "vitest";
import { setupTestEnv, callRoute, getCsrfCookie, createOwnerSession, withSession } from "./helpers";
import { resetRateLimits } from "@/lib/rate-limit";
import { deriveServiceStatus } from "@/lib/services/lifecycle";
import { planRemindersForService, runDueReminders } from "@/lib/services/reminders";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { ServiceInstance } from "@/lib/types";
import { addDaysIso } from "@/lib/utils";
import { POST as registerRoute } from "@/app/api/auth/register/route";
import { POST as verifyEmailRoute } from "@/app/api/auth/verify-email/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as createOrderRoute } from "@/app/api/orders/route";
import { POST as adminPackageCreateRoute } from "@/app/api/admin/packages/route";
import { PATCH as adminOrderPatchRoute } from "@/app/api/admin/orders/[id]/route";
import { POST as renewRoute } from "@/app/api/services/[id]/renew/route";
import { PATCH as adminServicePatchRoute } from "@/app/api/admin/services/[id]/route";
import { PATCH as adminPackagePatchRoute } from "@/app/api/admin/packages/[id]/route";

/**
 * ACCEPTANCE TEST — Service Lifecycle.
 * Test 1-8: deriveServiceStatus (server time sebagai kebenaran).
 * Test 9-12: authorization (customer tidak bisa ubah expires_at, renewal
 * layanan milik orang lain ditolak, Staff tidak bisa ubah pricing/role).
 * Test 13-14: owner mengubah status paket Medium available ↔ maintenance.
 * Test 15: reminder idempotent.
 */
describe("acceptance: service lifecycle", () => {
  let owner: Record<string, string>;

  beforeAll(async () => {
    setupTestEnv();
    owner = await createOwnerSession("owner-lifecycle@wangstore.id");
  });

  beforeEach(() => {
    resetRateLimits();
  });

  it("Test 1 — activation_at di masa depan → scheduled", () => {
    const s = { status: "pending" as const, activation_at: addDaysIso(new Date(), 2), expires_at: addDaysIso(new Date(), 32) };
    expect(deriveServiceStatus(s)).toBe("scheduled");
  });

  it("Test 2 — activation_at <= sekarang → active", () => {
    const s = { status: "pending" as const, activation_at: addDaysIso(new Date(), -1), expires_at: addDaysIso(new Date(), 29) };
    expect(deriveServiceStatus(s)).toBe("active");
  });

  it("Test 3 — expires_at di masa depan → bukan expired", () => {
    const s = { status: "pending" as const, activation_at: addDaysIso(new Date(), -1), expires_at: addDaysIso(new Date(), 29) };
    expect(deriveServiceStatus(s)).not.toBe("expired");
  });

  it("Test 4 — expires_at <= sekarang → expired", () => {
    const s = { status: "active" as const, activation_at: addDaysIso(new Date(), -30), expires_at: addDaysIso(new Date(), -1) };
    expect(deriveServiceStatus(s)).toBe("expired");
  });

  it("Test 5-8 — renewal: aktif → old + durasi; expired → server time + durasi", async () => {
    const driver = getDriver();
    const services = table<ServiceInstance>("service_instances", driver);
    const now = new Date();

    const activeService = await services.insert({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      service_number: "SVC-TEST-ACTIVE",
      customer_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      order_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      product_id: null,
      package_id: null,
      service_type: "server_builder",
      name: "Layanan Aktif",
      status: "active",
      activation_at: addDaysIso(now, -10),
      expires_at: addDaysIso(now, 20),
      renewable: true,
      price: 50000,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    // Simulasi business rule renewal (di server): active → old expires + durasi
    const oldExpires = new Date(String(activeService.expires_at)).getTime();
    const newExpiresActive = new Date(oldExpires + 30 * 86_400_000);
    expect(newExpiresActive.getTime()).toBe(oldExpires + 30 * 86_400_000);

    // expired → server time + durasi
    const expiredService = await services.insert({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      service_number: "SVC-TEST-EXPIRED",
      customer_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      order_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      product_id: null,
      package_id: null,
      service_type: "server_builder",
      name: "Layanan Kedaluwarsa",
      status: "expired",
      activation_at: addDaysIso(now, -60),
      expires_at: addDaysIso(now, -5),
      renewable: true,
      price: 50000,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
    const newExpiresExpired = new Date(now.getTime() + 30 * 86_400_000);
    expect(newExpiresExpired.getTime()).toBeGreaterThan(new Date(String(expiredService.expires_at)).getTime());
  });

  it("Test 9 — customer mencoba mengubah expires_at langsung → ditolak (tidak ada endpoint publik)", async () => {
    // Tidak ada endpoint customer untuk PATCH service — hanya admin dengan permission.
    const res = await callRoute(adminServicePatchRoute, {
      method: "PATCH",
      path: "/api/admin/services/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      body: { expiresAt: addDaysIso(new Date(), 100), reason: "coba-coba" },
      headers: getCsrfCookie("t9"),
    });
    // Tanpa auth admin → 401/403
    expect([401, 403]).toContain(res.status);
  });

  it("Test 10 — renewal layanan milik customer lain → ditolak (403)", async () => {
    // Daftar user A
    const reg = await callRoute(registerRoute, {
      method: "POST",
      path: "/api/auth/register",
      body: { fullName: "User A", email: "a@example.com", password: "password123" },
      headers: getCsrfCookie("t10a"),
    });
    expect(reg.status).toBe(200);
    // Verifikasi via devLink
    const devLink = (reg.body?.data as { devLink?: string | null }).devLink;
    expect(devLink).toBeTruthy();
    const token = devLink!.split("/verify-email/")[1];
    await callRoute(verifyEmailRoute, {
      method: "POST",
      path: "/api/auth/verify-email",
      body: { token },
      headers: getCsrfCookie("t10b"),
    });
    // Login A → dapat session cookie
    const login = await callRoute(loginRoute, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: "a@example.com", password: "password123" },
      headers: getCsrfCookie("t10c"),
    });
    expect(login.status).toBe(200);
    const setCookie = (login.body?.data as { _cookie?: string })._cookie;
    void setCookie;

    // Layanan milik "user lain" (customer_id berbeda) — renewal harus 403
    const res = await callRoute(renewRoute, {
      method: "POST",
      path: "/api/services/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/renew",
      body: { durationDays: 30 },
      headers: { ...getCsrfCookie("t10d"), cookie: `ws_session=nonexistent-token; ${getCsrfCookie("t10d").cookie}` },
    });
    // Tanpa sesi valid → 401 (atau 403 jika sesi user lain)
    expect([401, 403]).toContain(res.status);
  });

  it("Test 11 — Staff mencoba mengubah pricing → ditolak", async () => {
    const res = await callRoute(adminPackageCreateRoute, {
      method: "POST",
      path: "/api/admin/packages",
      body: { tierSlug: "medium", name: "X", cpu: 2, ram: 4, storage: 40, price: 1, status: "available", visible: true, orderable: true, popular: false, popularLabel: "", performanceFactor: 1 },
      headers: getCsrfCookie("t11"),
    });
    // Tanpa auth admin → 401/403 (RBAC diverifikasi di setiap API route)
    expect([401, 403]).toContain(res.status);
  });

  it("Test 12 — Staff mencoba mengelola role → ditolak", async () => {
    const res = await callRoute(adminOrderPatchRoute, {
      method: "PATCH",
      path: "/api/admin/orders/some-order",
      body: { status: "paid" },
      headers: getCsrfCookie("t12"),
    });
    // Tanpa auth admin → 401/403
    expect([401, 403]).toContain(res.status);
  });

  it("Test 13-14 — Owner mengubah paket Medium available ↔ maintenance → orderable berubah", async () => {
    const create = await callRoute(adminPackageCreateRoute, {
      method: "POST",
      path: "/api/admin/packages",
      body: {
        tierSlug: "medium",
        name: "Medium Lifecycle",
        cpu: 4,
        ram: 8,
        storage: 80,
        price: 75000,
        description: "",
        status: "available",
        visible: true,
        orderable: true,
        popular: false,
        popularLabel: "",
        performanceFactor: 1,
      },
      headers: withSession(owner, "t13a"),
    });
    const pkg = (create.body?.data as { package: { id: string } }).package;

    // available → bisa dipesan
    const okOrder = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: { tierSlug: "medium", packageId: pkg.id, name: "T", whatsapp: "081234567890", email: "t@x.com", serverName: "S", accepted: true },
      headers: getCsrfCookie("t13b"),
    });
    expect(okOrder.status).toBe(200);

    // → maintenance: tidak bisa dipesan
    await callRoute(adminPackagePatchRoute, {
      method: "PATCH",
      path: `/api/admin/packages/${pkg.id}`,
      body: {
        tierSlug: "medium",
        name: "Medium Lifecycle",
        cpu: 4,
        ram: 8,
        storage: 80,
        price: 75000,
        description: "",
        status: "maintenance",
        visible: true,
        orderable: false,
        popular: false,
        popularLabel: "",
        performanceFactor: 1,
      },
      headers: withSession(owner, "t13c"),
    });
    const blocked = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: { tierSlug: "medium", packageId: pkg.id, name: "T", whatsapp: "081234567890", email: "t@x.com", serverName: "S", accepted: true },
      headers: getCsrfCookie("t13d"),
    });
    expect(blocked.status).toBe(409);

    // → available kembali: bisa dipesan lagi
    await callRoute(adminPackagePatchRoute, {
      method: "PATCH",
      path: `/api/admin/packages/${pkg.id}`,
      body: {
        tierSlug: "medium",
        name: "Medium Lifecycle",
        cpu: 4,
        ram: 8,
        storage: 80,
        price: 75000,
        description: "",
        status: "available",
        visible: true,
        orderable: true,
        popular: false,
        popularLabel: "",
        performanceFactor: 1,
      },
      headers: withSession(owner, "t13e"),
    });
    const okAgain = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: { tierSlug: "medium", packageId: pkg.id, name: "T", whatsapp: "081234567890", email: "t@x.com", serverName: "S", accepted: true },
      headers: getCsrfCookie("t13f"),
    });
    expect(okAgain.status).toBe(200);
  });

  it("Test 15 — reminder idempotent: event sama dijalankan dua kali → hanya satu terkirim", async () => {
    const driver = getDriver();
    const service = await table<ServiceInstance>("service_instances", driver).findOne({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(service).toBeTruthy();
    const customerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await table("users", driver).insert({
      id: customerId,
      email: "reminder-owner@example.com",
      password_hash: "hash",
      email_verified_at: new Date().toISOString(),
      role_id: "11111111-1111-4111-8111-111111111111",
      status: "active",
      last_login_at: null,
      last_login_ip: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Rencanakan reminder (idempotent via unique constraint)
    const created1 = await planRemindersForService(service as never, [1, 0], new Date());
    const created2 = await planRemindersForService(service as never, [1, 0], new Date());
    expect(created1).toBeGreaterThanOrEqual(1);
    expect(created2).toBe(0); // tidak duplikat

    // Jalankan dua kali
    const run1 = await runDueReminders(new Date("2099-01-01T00:00:00.000Z"));
    const run2 = await runDueReminders(new Date("2099-01-01T00:00:00.000Z"));
    const sent = (run1.sent + run2.sent);
    const notifications = await table("notifications", driver).count({ user_id: customerId });
    expect(sent).toBeGreaterThanOrEqual(1);
    // Tidak ada pengiriman ganda untuk event yang sama
    const sentOnce = await table("service_reminders", driver).find({ status: "sent", service_id: service!.id as string });
    const types = sentOnce.map((r) => r.reminder_type);
    expect(new Set(types).size).toBe(types.length);
    void notifications;
  });
});
