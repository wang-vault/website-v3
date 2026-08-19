const BASE = "http://localhost:3000";
let cookie = "";
async function csrf() {
  const r = await fetch(`${BASE}/`, { redirect: "manual" });
  cookie = (r.headers.get("set-cookie") ?? "").split(";")[0] || cookie;
  const r2 = await fetch(`${BASE}/api/csrf`, { headers: { cookie } });
  return (await r2.json()).data.token;
}
const h = (t) => ({ "Content-Type": "application/json", "x-csrf-token": t, cookie });

let ok = 0, fail = 0;
const check = (label, cond) => { if (cond) { ok++; console.log(`  ✓ ${label}`); } else { fail++; console.error(`  ✗ ${label}`); } };

const t = await csrf();
const email = `e2e-${Date.now()}@wangstore.id`;
// 1. Register
const reg = await fetch(`${BASE}/api/auth/register`, { method: "POST", headers: h(t), body: JSON.stringify({ fullName: "E2E User", email, password: "password123" }) });
const regBody = await reg.json();
check("register → 200", reg.status === 200);
check("register tanpa SMTP → devLink tersedia (jujur)", !!regBody.data?.devLink && regBody.data?.emailSent === false);
const vtoken = regBody.data?.devLink?.split("/verify-email/")[1] ?? "";

// 2. Verify email
const ver = await fetch(`${BASE}/api/auth/verify-email`, { method: "POST", headers: h(t), body: JSON.stringify({ token: vtoken }) });
check("verify email → 200", ver.status === 200);

// 3. Login
const log = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: h(t), body: JSON.stringify({ email, password: "password123" }) });
const logBody = await log.json();
check("login → 200", log.status === 200);
check("role user dikenali (owner bila pertama / customer bila berikutnya)", ["owner", "customer"].includes(logBody.data?.user?.roleSlug));

// 4. Server Builder pricing API
const est = await fetch(`${BASE}/api/pricing/estimate`, { method: "POST", headers: h(t), body: JSON.stringify({ cpu: 4, ram: 8, storage: 40 }) });
const estBody = await est.json();
check("estimasi harga 4/8/40 → 85000", estBody.data?.price?.total === 85000);
check("estimasi berlabel estimate (bukan jaminan)", estBody.data?.estimate?.estTps >= 10);

// 5. Order
const ord = await fetch(`${BASE}/api/orders`, { method: "POST", headers: h(t), body: JSON.stringify({ tierSlug: "low", cpu: 4, ram: 8, storage: 40, name: "E2E User", whatsapp: "081234567890", email: "e2e@wangstore.id", serverName: "E2E Server", accepted: true }) });
const ordBody = await ord.json();
check("order → 200", ord.status === 200);
check("order total = 85000 (harga server)", ordBody.data?.total === 85000);
check("order number ada", !!ordBody.data?.orderNumber);
check("whatsapp URL null (nomor belum dikonfigurasi) — jujur", ordBody.data?.whatsappUrl === null);

// 6. Order confirmation page
const conf = await fetch(`${BASE}/order/${ordBody.data.orderId}`, { redirect: "manual" });
const confHtml = await conf.text();
check("halaman konfirmasi order → 200", conf.status === 200);
check("halaman konfirmasi noindex", confHtml.includes("noindex"));

// 7. Dashboard (login via session cookie dari login response — dev mode pakai token)
const dash = await fetch(`${BASE}/dashboard`, { redirect: "manual", headers: { cookie: `ws_session=${logBody.data.sessionToken}` } });
const dashHtml = await dash.text();
check("dashboard dengan sesi → 200", dash.status === 200 || dashHtml.includes("Ringkasan"));
check("dashboard memuat data", dashHtml.includes("WangStore"));

const isOwner = logBody.data?.user?.roleSlug === "owner";
// 8. Admin overview
if (isOwner) {
  const ov = await fetch(`${BASE}/api/admin/overview`, { headers: { authorization: `Bearer ${logBody.data.sessionToken}` } });
  const ovBody = await ov.json();
  check("admin overview (owner) → 200", ov.status === 200 && ovBody.success);
}

// 9. Admin RBAC
check("admin tanpa auth → 401", (await fetch(`${BASE}/api/admin/overview`)).status === 401);
if (!isOwner) {
  const ov2 = await fetch(`${BASE}/api/admin/overview`, { headers: { authorization: `Bearer ${logBody.data.sessionToken}` } });
  check("customer tidak bisa akses admin → 403", ov2.status === 403);
}

// 10. Dashboard tanpa sesi → redirect
const anon = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
check("dashboard anonim → redirect", [307,302,303].includes(anon.status) || (anon.status === 200 && (await anon.text()).includes("__next-page-redirect")));

console.log(`\nE2E: ${ok} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
