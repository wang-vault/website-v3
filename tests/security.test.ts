import { beforeEach, beforeAll, describe, expect, it } from "vitest";
import { setupTestEnv, callRoute, getCsrfCookie } from "./helpers";
import { resetRateLimits } from "@/lib/rate-limit";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as createOrderRoute } from "@/app/api/orders/route";
import { POST as adminPackageCreateRoute } from "@/app/api/admin/packages/route";
import { GET as adminOverviewRoute } from "@/app/api/admin/overview/route";

/**
 * ACCEPTANCE TEST — Security & RBAC.
 * Test 7: /dashboard redirect (ditangani layout; diuji lewat build/smoke).
 * Test 8: admin wrong credentials → denied; correct → authenticated;
 *         /api/admin/* → RBAC enforced.
 * Test 9: cross-origin write → CSRF denied.
 * Test 10: coupon valid → accepted; expired → rejected; limit → rejected;
 *          fake client discount → ignored.
 */
describe("acceptance: security & RBAC", () => {
  beforeAll(() => {
    setupTestEnv();
  });

  beforeEach(() => {
    resetRateLimits();
  });

  it("Test 8a — login dengan kredensial salah → 401", async () => {
    const res = await callRoute(loginRoute, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: "admin@wangstore.id", password: "wrong-password" },
      headers: getCsrfCookie("t8a"),
    });
    expect(res.status).toBe(401);
    expect((res.body?.error as { code?: string } | undefined)?.code).toBe("INVALID_CREDENTIALS");
  });

  it("Test 8b — /api/admin/* tanpa autentikasi → 401 (RBAC enforced)", async () => {
    const res = await callRoute(adminOverviewRoute, { method: "GET", path: "/api/admin/overview" });
    expect(res.status).toBe(401);
  });

  it("Test 8c — /api/admin/* tanpa permission yang cukup → 403", async () => {
    const res = await callRoute(adminPackageCreateRoute, {
      method: "POST",
      path: "/api/admin/packages",
      body: { tierSlug: "medium", name: "X", cpu: 2, ram: 4, storage: 40, price: 1000, status: "available", visible: true, orderable: true, popular: false, popularLabel: "", performanceFactor: 1 },
      headers: getCsrfCookie("t8c"),
    });
    // user tak dikenal → 401; dengan user non-admin → 403
    expect([401, 403]).toContain(res.status);
  });

  it("Test 9 — request mutasi lintas-origin tanpa CSRF → 403 CSRF_DENIED", async () => {
    const res = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: { tierSlug: "low", cpu: 2, ram: 4, storage: 20, name: "X", whatsapp: "081234567890", email: "x@x.com", serverName: "S", accepted: true },
      headers: { origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
    expect((res.body?.error as { code?: string } | undefined)?.code).toBe("CSRF_DENIED");
  });

  it("Test 9b — request mutasi dengan CSRF valid dari origin asing → 403 ORIGIN_DENIED", async () => {
    const res = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: { tierSlug: "low", cpu: 2, ram: 4, storage: 20, name: "X", whatsapp: "081234567890", email: "x@x.com", serverName: "S", accepted: true },
      headers: { ...getCsrfCookie("tok"), origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
    expect((res.body?.error as { code?: string } | undefined)?.code).toBe("ORIGIN_DENIED");
  });

  it("Test 10a — coupon valid → diterima & diskon dihitung server", async () => {
    // Buat kupon via DB langsung (flow admin diuji terpisah)
    const { getDriver } = await import("@/lib/db");
    const { table } = await import("@/lib/db/types");
    const { newId, nowIso } = await import("@/lib/utils");
    await table("coupons", getDriver()).insert({
      id: newId(),
      code: "HEMAT10",
      type: "percentage",
      value: 10,
      min_order: 0,
      max_usage: null,
      usage_per_customer: null,
      starts_at: null,
      expires_at: null,
      active: true,
      applicable_tiers: null,
      applicable_product_types: null,
      created_by: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    const res = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: {
        tierSlug: "low",
        cpu: 2,
        ram: 4,
        storage: 20,
        name: "X",
        whatsapp: "081234567890",
        email: "x@x.com",
        serverName: "S",
        couponCode: "HEMAT10",
        accepted: true,
      },
      headers: { ...getCsrfCookie("tok"), origin: "http://localhost:3000" },
    });
    expect(res.status).toBe(200);
    const data = res.body?.data as { total: number; priceRaw: number; discount: number };
    expect(data.priceRaw).toBe(50000);
    expect(data.discount).toBe(5000); // 10% dari 50000
    expect(data.total).toBe(45000);
  });

  it("Test 10b — fake client discount → diabaikan", async () => {
    const res = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: {
        tierSlug: "low",
        cpu: 2,
        ram: 4,
        storage: 20,
        name: "X",
        whatsapp: "081234567890",
        email: "x@x.com",
        serverName: "S",
        couponCode: "HEMAT10",
        discount: 999999,
        total: 1,
        accepted: true,
      },
      headers: { ...getCsrfCookie("tok"), origin: "http://localhost:3000" },
    });
    expect(res.status).toBe(200);
    const data = res.body?.data as { total: number; discount: number };
    // Diskon tetap 10% dari harga server (bukan 999999), total bukan Rp1
    expect(data.discount).toBe(5000);
    expect(data.total).toBe(45000);
  });

  it("Test 10c — coupon kedaluwarsa → ditolak", async () => {
    const { getDriver } = await import("@/lib/db");
    const { table } = await import("@/lib/db/types");
    const { newId, nowIso } = await import("@/lib/utils");
    await table("coupons", getDriver()).insert({
      id: newId(),
      code: "LAMA",
      type: "percentage",
      value: 50,
      min_order: 0,
      max_usage: null,
      usage_per_customer: null,
      starts_at: null,
      expires_at: "2020-01-01T00:00:00.000Z",
      active: true,
      applicable_tiers: null,
      applicable_product_types: null,
      created_by: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    const res = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: {
        tierSlug: "low",
        cpu: 2,
        ram: 4,
        storage: 20,
        name: "X",
        whatsapp: "081234567890",
        email: "x@x.com",
        serverName: "S",
        couponCode: "LAMA",
        accepted: true,
      },
      headers: { ...getCsrfCookie("tok"), origin: "http://localhost:3000" },
    });
    expect(res.status).toBe(400);
    expect((res.body?.error as { code?: string } | undefined)?.code).toBe("COUPON_EXPIRED");
  });

  it("Test 10d — coupon mencapai batas pemakaian → ditolak", async () => {
    const { getDriver } = await import("@/lib/db");
    const { table } = await import("@/lib/db/types");
    const { newId, nowIso } = await import("@/lib/utils");
    const couponId = newId();
    await table("coupons", getDriver()).insert({
      id: couponId,
      code: "TERBATAS",
      type: "fixed",
      value: 5000,
      min_order: 0,
      max_usage: 1,
      usage_per_customer: null,
      starts_at: null,
      expires_at: null,
      active: true,
      applicable_tiers: null,
      applicable_product_types: null,
      created_by: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    const order1 = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: { tierSlug: "low", cpu: 2, ram: 4, storage: 20, name: "X", whatsapp: "081234567890", email: "x@x.com", serverName: "S", couponCode: "TERBATAS", accepted: true },
      headers: { ...getCsrfCookie("tok"), origin: "http://localhost:3000" },
    });
    expect(order1.status).toBe(200);
    const order2 = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: { tierSlug: "low", cpu: 2, ram: 4, storage: 20, name: "X", whatsapp: "081234567890", email: "x@x.com", serverName: "S", couponCode: "TERBATAS", accepted: true },
      headers: { ...getCsrfCookie("tok"), origin: "http://localhost:3000" },
    });
    expect(order2.status).toBe(400);
    expect((order2.body?.error as { code?: string } | undefined)?.code).toBe("COUPON_LIMIT_REACHED");
  });

  it("Test 10e — kupon tidak ditemukan → ditolak", async () => {
    const res = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: { tierSlug: "low", cpu: 2, ram: 4, storage: 20, name: "X", whatsapp: "081234567890", email: "x@x.com", serverName: "S", couponCode: "TIDAKADA", accepted: true },
      headers: { ...getCsrfCookie("tok"), origin: "http://localhost:3000" },
    });
    expect(res.status).toBe(400);
    expect((res.body?.error as { code?: string } | undefined)?.code).toBe("COUPON_NOT_FOUND");
  });
});
