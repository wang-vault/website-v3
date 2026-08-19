import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { createHmac } from "crypto";
import { resetDriver } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";

/** Siapkan environment test dengan JSON datastore di direktori sementara. */
export function setupTestEnv(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "wangstore-test-"));
  (process.env as Record<string, string>).NODE_ENV = "test";
  process.env.DATABASE_URL = "";
  process.env.WANGSTORE_DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-secret-1234567890-abcdefghijklmnop";
  process.env.SMTP_HOST = "";
  resetDriver();
  resetRateLimits();
  return dir;
}

/** Jalankan handler route API Next.js dengan Request buatan. */
type RouteHandler = (req: Request, ctx: { params?: Record<string, string> }) => Promise<Response>;

export async function callRoute(
  handler: RouteHandler,
  input: { method?: string; path?: string; body?: unknown; headers?: Record<string, string> },
) {
  const method = input.method ?? "GET";
  const headers: Record<string, string> = { ...(input.headers ?? {}) };
  let body: string | undefined;
  if (input.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(input.body);
  }
  const req = new Request(`http://localhost:3000${input.path ?? "/"}`, {
    method,
    headers,
    body,
  });
  const res = await handler(req, { params: paramsFromPath(input.path ?? "/") } as { params?: Record<string, string> });
  const setCookie = res.headers.get("set-cookie") ?? undefined;
  return {
    status: res.status,
    body: (await res.json().catch(() => null)) as Record<string, unknown> | null,
    setCookie,
  };
}

/**
 * Alur lengkap: register (user pertama = OWNER) → verifikasi email (devLink)
 * → login → ambil cookie sesi. Kembalikan header untuk request berikutnya.
 */
export async function createOwnerSession(email = "owner@wangstore.id"): Promise<Record<string, string>> {
  const { POST: registerRoute } = await import("@/app/api/auth/register/route");
  const { POST: verifyRoute } = await import("@/app/api/auth/verify-email/route");
  const { POST: loginRoute } = await import("@/app/api/auth/login/route");

  const reg = await callRoute(registerRoute, {
    method: "POST",
    path: "/api/auth/register",
    body: { fullName: "Owner Test", email, password: "password123" },
    headers: getCsrfCookie("reg"),
  });
  if (reg.status !== 200) throw new Error(`register gagal: ${reg.status} ${JSON.stringify(reg.body)}`);
  const devLink = (reg.body?.data as { devLink?: string | null }).devLink;
  if (!devLink) throw new Error("devLink tidak tersedia (SMTP dikonfigurasi di test?)");
  const token = devLink.split("/verify-email/")[1];
  const verify = await callRoute(verifyRoute, {
    method: "POST",
    path: "/api/auth/verify-email",
    body: { token },
    headers: getCsrfCookie("v"),
  });
  if (verify.status !== 200) throw new Error(`verify gagal: ${verify.status}`);

  const login = await callRoute(loginRoute, {
    method: "POST",
    path: "/api/auth/login",
    body: { email, password: "password123" },
    headers: getCsrfCookie("l"),
  });
  if (login.status !== 200) throw new Error(`login gagal: ${login.status}`);
  const sessionToken = (login.body?.data as { sessionToken?: string }).sessionToken;
  if (!sessionToken) throw new Error("session token tidak ditemukan");
  return { token: sessionToken };
}

/** Gabungkan token sesi (Authorization Bearer) + CSRF. */
export function withSession(session: Record<string, string>, csrfToken: string): Record<string, string> {
  const csrf = getCsrfCookie(csrfToken);
  return { ...csrf, authorization: `Bearer ${session.token}` };
}

export function paramsFromPath(p: string): Record<string, string> {
  const parts = p.split("/").filter(Boolean);
  const params: Record<string, string> = {};
  // route: /api/orders/[id] → p: /api/orders/abc → params.id = abc
  if (parts[0] === "api") {
    // heuristic: pasangan segment terakhir
    const last = parts[parts.length - 1];
    if (parts.includes("orders") && parts.length >= 3 && parts[parts.length - 2] === "orders") params.id = last;
    else if (parts.includes("services") && parts.length >= 3 && parts[parts.length - 2] === "services") params.id = last;
    else if (parts.includes("tickets") && parts.length >= 3 && parts[parts.length - 2] === "tickets") params.id = last;
    else if (parts.includes("coupons") && parts.length >= 3 && parts[parts.length - 2] === "coupons") params.id = last;
    else if (parts.includes("users") && parts.length >= 3 && parts[parts.length - 2] === "users") params.id = last;
    else if (parts.includes("packages") && parts.length >= 3 && parts[parts.length - 2] === "packages") params.id = last;
    else if (parts.includes("customers") && parts.length >= 3 && parts[parts.length - 2] === "customers") params.id = last;
    else if (parts.includes("vps-packages") && parts.length >= 3 && parts[parts.length - 2] === "vps-packages") params.id = last;
    else if (parts.includes("locations") && parts.length >= 3 && parts[parts.length - 2] === "locations") params.id = last;
    else if (parts.includes("blog") && parts.length >= 3 && parts[parts.length - 2] === "blog") params.slug = last;
    else if (parts.includes("knowledge-base") && parts.length >= 3 && parts[parts.length - 2] === "knowledge-base") params.slug = last;
    else if (parts.includes("cms")) {
      const idx = parts.indexOf("cms");
      params.resource = parts[idx + 1] ?? "";
      params.id = parts[idx + 2] ?? "";
    }
  }
  return params;
}

/** Helper: panggil API dengan cookie CSRF yang sah (double-submit). */
export function csrfHeaders(): Record<string, string> {
  return { "x-csrf-token": "test-token", cookie: "ws_csrf=test-token.sig" };
}

function testSignCsrf(token: string): string {
  const secret = process.env.AUTH_SECRET ?? "test";
  return createHmac("sha256", secret).update(`csrf:${token}`).digest("base64url");
}

export function getCsrfCookie(token: string): Record<string, string> {
  return { "x-csrf-token": token, cookie: `ws_csrf=${token}.${testSignCsrf(token)}` };
}

export { path as testPath };
