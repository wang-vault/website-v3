import { randomToken } from "@/lib/utils";

export const CSRF_COOKIE = "ws_csrf";
export const SESSION_COOKIE = "ws_session";

/** Token CSRF random untuk double-submit cookie. */
export function newCsrfToken(): string {
  return randomToken(24);
}

function bytesToBase64url(bytes: Uint8Array): string {
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * HMAC-SHA256 (Web Crypto — kompatibel edge & Node).
 * Mengikat token CSRF ke secret AUTH_SECRET (anti token-swap).
 */
export async function signCsrf(token: string): Promise<string> {
  const secret = process.env.AUTH_SECRET ?? "dev-secret-change-me";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`csrf:${token}`));
  return bytesToBase64url(new Uint8Array(sig));
}

/** Format cookie CSRF: `${token}.${signature}`. */
export async function buildCsrfCookieValue(token: string): Promise<string> {
  return `${token}.${await signCsrf(token)}`;
}

function base64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function verifyCsrf(
  token: string | undefined | null,
  signed: string | undefined | null,
): Promise<boolean> {
  if (!token || !signed) return false;
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) return false;
  const tokenPart = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  if (tokenPart !== token) return false;
  const expected = await signCsrf(token);
  const a = base64urlToBytes(expected);
  const b = base64urlToBytes(sig);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Sanitasi rekursif untuk input dari client:
 * - string: trim, batasi panjang, buang null byte
 * - array/object: rekursif, batasi kedalaman
 * - lainnya: dipertahankan
 */
export function sanitizeInput<T>(value: T, depth = 0, maxDepth = 6): T {
  if (value === null || value === undefined) return value;
  if (depth > maxDepth) {
    if (typeof value === "string") return value.slice(0, 200) as T;
    return (Array.isArray(value) ? [] : {}) as T;
  }
  if (typeof value === "string") {
    return value.replace(/\0/g, "").slice(0, 10_000).trim() as T;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeInput(v, depth + 1, maxDepth)) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeInput(v, depth + 1, maxDepth);
    }
    return out as T;
  }
  return value;
}

const MAX_PAYLOAD_BYTES = 1_000_000; // 1 MB

export async function readJsonBody(request: Request): Promise<unknown | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError("Content-Type harus application/json.", "INVALID_CONTENT_TYPE", 415);
  }
  const text = await request.text();
  if (text.length > MAX_PAYLOAD_BYTES) {
    throw new ApiError("Ukuran payload melebihi batas.", "PAYLOAD_TOO_LARGE", 413);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError("JSON tidak valid.", "INVALID_JSON", 400);
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Response JSON konsisten: { success, data } / { success: false, error: { code, message } }. */
export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ success: true, data }, init);
}

export function fail(error: unknown): Response {
  if (error instanceof ApiError) {
    const body = { success: false as const, error: { code: error.code, message: error.message, details: error.details } };
    return Response.json(body, { status: error.status });
  }
  if (error instanceof Error) {
    // ZodError diterjemahkan oleh pemanggil menjadi ApiError; fallback aman.
    console.error("[api] error:", error);
    return Response.json(
      { success: false as const, error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan internal. Silakan coba lagi." } },
      { status: 500 },
    );
  }
  return Response.json(
    { success: false as const, error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan internal." } },
    { status: 500 },
  );
}

/** Asal (origin) yang diizinkan untuk request lintas-origin. */
export function allowedOrigins(): string[] {
  const origins = new Set<string>();
  for (const v of [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    if (v) origins.add(v.replace(/\/+$/, ""));
  }
  origins.add("http://localhost:3000");
  origins.add("http://127.0.0.1:3000");
  return [...origins];
}

/**
 * Validasi Origin/Host untuk request mutasi (CSRF defense-in-depth).
 * - Origin harus dari daftar yang diizinkan, ATAU berasal dari Vercel preview
 *   (domain *.vercel.app / *.e2b.app untuk environment sandbox).
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const host = origin.replace(/^https?:\/\//, "").split("/")[0];
  if (allowedOrigins().some((o) => o.replace(/^https?:\/\//, "") === host)) return true;
  if (host.endsWith(".vercel.app")) return true;
  if (host.endsWith(".e2b.app")) return true;
  return false;
}
