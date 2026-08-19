import { beforeEach, beforeAll, describe, expect, it } from "vitest";
import { setupTestEnv, callRoute, getCsrfCookie, createOwnerSession, withSession } from "./helpers";
import { resetRateLimits } from "@/lib/rate-limit";
import { POST as createOrderRoute } from "@/app/api/orders/route";
import { POST as pricingEstimateRoute } from "@/app/api/pricing/estimate/route";
import { GET as packagesRoute } from "@/app/api/packages/route";
import { POST as adminPackageCreateRoute } from "@/app/api/admin/packages/route";
import { PATCH as adminPackagePatchRoute } from "@/app/api/admin/packages/[id]/route";

/**
 * ACCEPTANCE TEST — Server Builder & Order API.
 * Medium/High TIDAK diuji dengan package ID hardcoded: package dibuat
 * melalui Owner/Admin flow terlebih dahulu (sesuai requirement).
 */
describe("acceptance: Server Builder & Order API", () => {
  let owner: Record<string, string>;

  beforeAll(async () => {
    setupTestEnv();
    owner = await createOwnerSession("owner-builder@wangstore.id");
  });

  beforeEach(() => {
    resetRateLimits();
  });

  it("Test 2 — Low minimum (2 core/4 GB/20 GB) → Rp45.000 raw, final Rp50.000", async () => {
    const res = await callRoute(pricingEstimateRoute, {
      method: "POST",
      body: { cpu: 2, ram: 4, storage: 20 },
      headers: getCsrfCookie("t1"),
    });
    expect(res.status).toBe(200);
    const price = res.body?.data as { price: { subtotal: number; total: number } };
    expect(price.price.subtotal).toBe(45000);
    expect(price.price.total).toBe(50000);
  });

  it("Test 3 — Low overflow (20/64/900) → dinormalisasi 16/32/160", async () => {
    const res = await callRoute(pricingEstimateRoute, {
      method: "POST",
      body: { cpu: 20, ram: 64, storage: 900 },
      headers: getCsrfCookie("t2"),
    });
    expect(res.status).toBe(200);
    const data = res.body?.data as { config: { cpu: number; ram: number; storage: number } };
    expect(data.config.cpu).toBe(16);
    expect(data.config.ram).toBe(32);
    expect(data.config.storage).toBe(160);
  });

  it("Test 1 — Owner membuat paket Medium 4/8/80 Rp75.000 available → muncul di Server Builder & dapat dipesan", async () => {
    // Owner membuat paket Medium
    const create = await callRoute(adminPackageCreateRoute, {
      method: "POST",
      path: "/api/admin/packages",
      body: {
        tierSlug: "medium",
        name: "Medium 8GB",
        cpu: 4,
        ram: 8,
        storage: 80,
        price: 75000,
        description: "Paket acceptance test",
        status: "available",
        visible: true,
        orderable: true,
        popular: false,
        popularLabel: "",
        performanceFactor: 1.15,
      },
      headers: withSession(owner, "t3"),
    });
    expect(create.status).toBe(200);
    const pkg = (create.body?.data as { package: { id: string; price: number } }).package;
    expect(pkg.price).toBe(75000);

    // Muncul di Server Builder (API packages)
    const list = await callRoute(packagesRoute, { method: "GET", path: "/api/packages?tier=medium" });
    expect(list.status).toBe(200);
    const packages = (list.body?.data as { packages: { id: string; name: string; price: number }[] }).packages;
    const found = packages.find((p) => p.id === pkg.id);
    expect(found).toBeDefined();
    expect(found?.price).toBe(75000);

    // Order API menggunakan harga Rp75.000
    const order = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: {
        tierSlug: "medium",
        packageId: pkg.id,
        name: "Test User",
        whatsapp: "081234567890",
        email: "test@example.com",
        serverName: "Server Test",
        notes: "",
        couponCode: "",
        accepted: true,
      },
      headers: getCsrfCookie("t4"),
    });
    expect(order.status).toBe(200);
    const orderData = order.body?.data as { orderNumber: string; total: number; priceRaw: number; status: string };
    expect(orderData.total).toBe(75000);
    expect(orderData.priceRaw).toBe(75000);
    expect(orderData.status).toBe("awaiting_payment");
  });

  it("Owner mengubah harga paket High 600.000 → 550.000 → Builder & Order API memakai harga baru", async () => {
    // Buat paket High 600.000
    const create = await callRoute(adminPackageCreateRoute, {
      method: "POST",
      path: "/api/admin/packages",
      body: {
        tierSlug: "high",
        name: "High 16GB",
        cpu: 8,
        ram: 16,
        storage: 160,
        price: 600000,
        description: "Paket high",
        status: "available",
        visible: true,
        orderable: true,
        popular: false,
        popularLabel: "",
        performanceFactor: 1.3,
      },
      headers: withSession(owner, "t5"),
    });
    expect(create.status).toBe(200);
    const pkg = (create.body?.data as { package: { id: string } }).package;

    // Ubah harga menjadi 550.000
    const update = await callRoute(adminPackagePatchRoute, {
      method: "PATCH",
      path: `/api/admin/packages/${pkg.id}`,
      body: {
        tierSlug: "high",
        name: "High 16GB",
        cpu: 8,
        ram: 16,
        storage: 160,
        price: 550000,
        description: "Paket high",
        status: "available",
        visible: true,
        orderable: true,
        popular: false,
        popularLabel: "",
        performanceFactor: 1.3,
      },
      headers: withSession(owner, "t6"),
    });
    expect(update.status).toBe(200);

    // Server Builder menampilkan 550.000
    const list = await callRoute(packagesRoute, { method: "GET", path: "/api/packages?tier=high" });
    const packages = (list.body?.data as { packages: { id: string; price: number }[] }).packages;
    expect(packages.find((p) => p.id === pkg.id)?.price).toBe(550000);

    // Order API menggunakan 550.000
    const order = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: {
        tierSlug: "high",
        packageId: pkg.id,
        name: "Test User",
        whatsapp: "081234567890",
        email: "test2@example.com",
        serverName: "Server High",
        accepted: true,
      },
      headers: getCsrfCookie("t7"),
    });
    expect(order.status).toBe(200);
    expect((order.body?.data as { total: number }).total).toBe(550000);
  });

  it("Owner menonaktifkan paket → tidak dapat dipesan (409)", async () => {
    const create = await callRoute(adminPackageCreateRoute, {
      method: "POST",
      path: "/api/admin/packages",
      body: {
        tierSlug: "medium",
        name: "Medium Nonaktif",
        cpu: 2,
        ram: 4,
        storage: 40,
        price: 50000,
        description: "",
        status: "available",
        visible: true,
        orderable: true,
        popular: false,
        popularLabel: "",
        performanceFactor: 1,
      },
      headers: withSession(owner, "t8"),
    });
    const pkg = (create.body?.data as { package: { id: string } }).package;

    await callRoute(adminPackagePatchRoute, {
      method: "PATCH",
      path: `/api/admin/packages/${pkg.id}`,
      body: {
        tierSlug: "medium",
        name: "Medium Nonaktif",
        cpu: 2,
        ram: 4,
        storage: 40,
        price: 50000,
        description: "",
        status: "maintenance",
        visible: true,
        orderable: false,
        popular: false,
        popularLabel: "",
        performanceFactor: 1,
      },
      headers: withSession(owner, "t9"),
    });

    const order = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: {
        tierSlug: "medium",
        packageId: pkg.id,
        name: "Test User",
        whatsapp: "081234567890",
        email: "test3@example.com",
        serverName: "Server X",
        accepted: true,
      },
      headers: getCsrfCookie("t10"),
    });
    expect(order.status).toBe(409);
  });

  it("Test 4 — Medium tanpa paket → HTTP 422 (bukan Rp0)", async () => {
    const res = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: {
        tierSlug: "medium",
        name: "Test",
        whatsapp: "081234567890",
        email: "t@example.com",
        serverName: "S",
        accepted: true,
      },
      headers: getCsrfCookie("t11"),
    });
    expect(res.status).toBe(422);
    expect((res.body?.error as { code?: string } | undefined)?.code).toBe("PACKAGE_REQUIRED");
  });

  it("Test 5 — fake packageId → HTTP 422", async () => {
    const res = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: {
        tierSlug: "high",
        packageId: "00000000-0000-4000-8000-000000000000",
        name: "Test",
        whatsapp: "081234567890",
        email: "t@example.com",
        serverName: "S",
        accepted: true,
      },
      headers: getCsrfCookie("t12"),
    });
    expect(res.status).toBe(422);
    expect((res.body?.error as { code?: string } | undefined)?.code).toBe("PACKAGE_NOT_FOUND");
  });

  it("tier tidak dikenal → ditolak (422), tidak pernah Rp0", async () => {
    const res = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: {
        tierSlug: "ultra",
        name: "Test",
        whatsapp: "081234567890",
        email: "t@example.com",
        serverName: "S",
        accepted: true,
      },
      headers: getCsrfCookie("t13"),
    });
    expect([400, 422]).toContain(res.status);
  });

  it("harga dari client DIABAIKAN — server menghitung ulang", async () => {
    // Kirim harga palsu Rp1 di body; server harus tetap memakai harga server-side.
    const create = await callRoute(adminPackageCreateRoute, {
      method: "POST",
      path: "/api/admin/packages",
      body: {
        tierSlug: "medium",
        name: "Medium Fixed",
        cpu: 4,
        ram: 8,
        storage: 80,
        price: 90000,
        description: "",
        status: "available",
        visible: true,
        orderable: true,
        popular: false,
        popularLabel: "",
        performanceFactor: 1,
      },
      headers: withSession(owner, "t14"),
    });
    const pkg = (create.body?.data as { package: { id: string } }).package;
    const res = await callRoute(createOrderRoute, {
      method: "POST",
      path: "/api/orders",
      body: {
        tierSlug: "medium",
        packageId: pkg.id,
        price: 1,
        total: 1,
        name: "Test",
        whatsapp: "081234567890",
        email: "t@example.com",
        serverName: "S",
        accepted: true,
      },
      headers: getCsrfCookie("t15"),
    });
    expect(res.status).toBe(200);
    expect((res.body?.data as { total: number }).total).toBe(90000);
  });
});
