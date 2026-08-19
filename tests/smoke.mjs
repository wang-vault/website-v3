/**
 * SMOKE TEST — HTTP smoke test untuk WangStore.
 * Prasyarat: aplikasi berjalan (mis. `npm run dev`) di BASE_URL.
 *
 * Penggunaan:
 *   BASE_URL=http://localhost:3000 node tests/smoke.mjs
 *   (default: http://localhost:3000)
 *
 * Memeriksa:
 *   - Halaman publik → HTTP 200
 *   - /dashboard tanpa login → redirect ke /login
 *   - API dasar → 200 (health, pricing, packages, status)
 *   - robots.txt & sitemap.xml → 200
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const PUBLIC_PAGES = [
  "/",
  "/about",
  "/infrastructure",
  "/server-builder",
  "/features",
  "/why-wangstore",
  "/faq",
  "/testimonials",
  "/blog",
  "/knowledge-base",
  "/status",
  "/contact",
  "/terms",
  "/privacy",
  "/refund",
  "/sla",
  "/acceptable-use",
  "/cookie-policy",
];

const API_ENDPOINTS = [
  "/api/health",
  "/api/pricing",
  "/api/packages?tier=medium",
  "/api/packages?tier=high",
  "/api/vps",
  "/api/products",
  "/api/status",
  "/api/faq",
  "/api/testimonials",
  "/api/blog",
  "/api/knowledge-base",
];

let failures = 0;
let passes = 0;

async function check(label, fn) {
  try {
    const result = await fn();
    if (result) {
      passes++;
      console.log(`  ✓ ${label}`);
    } else {
      failures++;
      console.error(`  ✗ ${label}`);
    }
  } catch (e) {
    failures++;
    console.error(`  ✗ ${label}: ${e.message}`);
  }
}

async function getStatus(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual", ...opts });
  return { status: res.status, headers: res.headers, location: res.headers.get("location") };
}

console.log(`\nWangStore smoke test → ${BASE}\n`);
console.log("Public pages (harus 200):");
for (const page of PUBLIC_PAGES) {
  await check(page, async () => {
    const { status } = await getStatus(page);
    if (status !== 200) {
      console.error(`    (status ${status})`);
      return false;
    }
    return true;
  });
}

console.log("\nPrivate route (harus redirect ke /login):");
await check("/dashboard tanpa login → redirect", async () => {
  const res = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  const body = await res.text();
  // Production: 307/302 ke /login. Dev: soft redirect (meta refresh).
  if (res.status === 307 || res.status === 302 || res.status === 303) {
    return res.headers.get("location")?.includes("/login") ?? false;
  }
  if (res.status === 200 && body.includes("__next-page-redirect") && body.includes("/login")) {
    return true;
  }
  console.error(`    (status ${res.status}, tanpa redirect)`);
  return false;
});

console.log("\nAPI endpoints (harus 200):");
for (const ep of API_ENDPOINTS) {
  await check(ep, async () => {
    const res = await fetch(`${BASE}${ep}`, { redirect: "manual" });
    if (res.status !== 200) {
      console.error(`    (status ${res.status})`);
      return false;
    }
    return true;
  });
}

console.log("\nSEO:");
await check("/robots.txt", async () => {
  const { status } = await getStatus("/robots.txt");
  return status === 200;
});
await check("/sitemap.xml", async () => {
  const { status } = await getStatus("/sitemap.xml");
  return status === 200;
});

console.log("\nAuth flow API:");
async function getCsrf() {
  // Request pertama menerima cookie ws_csrf dari middleware (Set-Cookie).
  const res = await fetch(`${BASE}/`, { redirect: "manual" });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  const res2 = await fetch(`${BASE}/api/csrf`, { headers: cookie ? { cookie } : {} });
  const body = await res2.json();
  return { token: body?.data?.token ?? "", cookie };
}
const { token: csrf, cookie: csrfCookie } = await getCsrf();
await check("csrf token tersedia", async () => {
  return csrf.length > 0 && csrfCookie.length > 0;
});
const authHeaders = (token) => ({
  "Content-Type": "application/json",
  "x-csrf-token": token,
  cookie: csrfCookie,
});
const smokeEmail = `smoke-${Date.now()}@wangstore.id`;
await check("register (tanpa SMTP → tetap 200 + devLink)", async () => {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: authHeaders(csrf),
    body: JSON.stringify({ fullName: "Smoke User", email: smokeEmail, password: "password123" }),
  });
  return res.status === 200;
});
await check("login kredensial salah → 401", async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: authHeaders(csrf),
    body: JSON.stringify({ email: smokeEmail, password: "salah" }),
  });
  return res.status === 401;
});
await check("order tanpa CSRF → 403", async () => {
  const res = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tierSlug: "low", cpu: 2, ram: 4, storage: 20, name: "X", whatsapp: "081234567890", email: "x@x.com", serverName: "S", accepted: true }),
  });
  return res.status === 403;
});

console.log(`\nHasil: ${passes} lulus, ${failures} gagal\n`);
if (failures > 0) process.exit(1);
