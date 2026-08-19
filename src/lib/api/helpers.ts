import { getDriver } from "@/lib/db";
import type { SqlDriver } from "@/lib/db/types";
import { getSettings, maintenanceAllowed } from "@/lib/settings";
import { getUserFromHeader, getSessionUser, hasPermission } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { ApiError, CSRF_COOKIE, fail, isAllowedOrigin, ok, verifyCsrf } from "@/lib/security";
import type { AuthedUser } from "@/lib/types";

export interface ApiContext {
  request: Request;
  params: Record<string, string>;
  user: AuthedUser | null;
  ip: string;
  db: SqlDriver;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiOptionsBase {
  methods?: HttpMethod[];
  /** Permission RBAC yang wajib dimiliki user (untuk auth=admin). */
  permission?: string;
  rateLimit?: { limit: number };
  /** Nonaktifkan pengecekan CSRF (hanya untuk GET atau endpoint internal). */
  skipCsrf?: boolean;
  /** Lewati pemeriksaan maintenance mode (mis. /api/health, cron). */
  skipMaintenance?: boolean;
}

/**
 * ApiOptions bertipe-diskriminasi: handler dengan auth "required"/"admin"
 * menerima `user` yang dijamin non-null (TypeScript narrowing).
 */
export type ApiOptions =
  | (ApiOptionsBase & { auth?: "optional" | undefined; handler: (ctx: ApiContext) => Promise<Response> })
  | (ApiOptionsBase & { auth: "required" | "admin"; handler: (ctx: ApiContext & { user: AuthedUser }) => Promise<Response> });

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}

function isMutation(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method);
}

/** Verifikasi CSRF double-submit: header x-csrf-token harus cocok dengan cookie bertanda tangan. */
async function verifyRequestCsrf(request: Request): Promise<boolean> {
  const header = request.headers.get("x-csrf-token");
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  if (!match) return false;
  const signed = decodeURIComponent(match.slice(CSRF_COOKIE.length + 1));
  return verifyCsrf(header, signed);
}

/** Bungkus seluruh route handler API dengan alur keamanan yang konsisten. */
export function api(opts: ApiOptions): (req: Request, ctx: { params?: Record<string, string> }) => Promise<Response> {
  return async (req: Request, routeCtx: { params?: Record<string, string> } = {}) => {
    const ip = clientIp(req);
    const method = req.method;
    try {
      // narrowing internal: handler aslinya selalu menerima user nullable-safe
      const handler = opts.handler as (ctx: ApiContext) => Promise<Response>;
      if (opts.methods && !opts.methods.includes(method as never)) {
        throw new ApiError("Metode tidak diizinkan.", "METHOD_NOT_ALLOWED", 405);
      }

      // Rate limiting (per IP, per endpoint)
      if (opts.rateLimit) {
        const result = rateLimit({ ip, route: `${method} ${req.url.split("/api/")[1]?.split("?")[0] ?? ""}`, limit: opts.rateLimit.limit });
        if (!result.ok) {
          return Response.json(
            {
              success: false,
              error: {
                code: "RATE_LIMITED",
                message: "Terlalu banyak permintaan. Silakan coba lagi dalam beberapa saat.",
                retryAfterSec: result.retryAfterSec,
              },
            },
            { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
          );
        }
      }

      // CSRF + Origin untuk request mutasi
      if (isMutation(method) && !opts.skipCsrf) {
        if (!(await verifyRequestCsrf(req))) {
          throw new ApiError("Token keamanan tidak valid. Muat ulang halaman lalu coba lagi.", "CSRF_DENIED", 403);
        }
        const origin = req.headers.get("origin");
        if (origin && !isAllowedOrigin(origin)) {
          throw new ApiError("Asal permintaan tidak diizinkan.", "ORIGIN_DENIED", 403);
        }
      }

      // Autentikasi
      let user: AuthedUser | null = null;
      if (opts.auth !== undefined) {
        user = (await getSessionUser()) ?? (await getUserFromHeader(req));
        if (opts.auth === "required" && !user) {
          throw new ApiError("Silakan masuk terlebih dahulu.", "UNAUTHORIZED", 401);
        }
        if (opts.auth === "admin") {
          if (!user) throw new ApiError("Silakan masuk terlebih dahulu.", "UNAUTHORIZED", 401);
          if (!["owner", "admin", "staff"].includes(user.roleSlug)) {
            throw new ApiError("Akses ditolak: Anda bukan staf.", "FORBIDDEN", 403);
          }
          if (opts.permission && !hasPermission(user, opts.permission)) {
            throw new ApiError("Akses ditolak: permission tidak mencukupi.", "FORBIDDEN", 403);
          }
        }
      }

      // Maintenance mode (kecuali jalur yang diizinkan & admin)
      if (!opts.skipMaintenance) {
        const settings = await getSettings();
        if (settings.maintenanceEnabled && !maintenanceAllowed(req.url.split("/api/")[1] ? `/api/${req.url.split("/api/")[1]?.split("?")[0] ?? ""}` : "/", settings)) {
          const isStaff = user && ["owner", "admin", "staff"].includes(user.roleSlug);
          if (!isStaff) {
            throw new ApiError(settings.maintenanceMessage || "Sedang dalam pemeliharaan.", "MAINTENANCE", 503);
          }
        }
      }

      return await handler({
        request: req,
        params: routeCtx.params ?? {},
        user,
        ip,
        db: getDriver(),
      });
    } catch (e) {
      return fail(e);
    }
  };
}

export function requireUser(ctx: ApiContext): AuthedUser {
  if (!ctx.user) throw new ApiError("Silakan masuk terlebih dahulu.", "UNAUTHORIZED", 401);
  return ctx.user;
}

export function requirePermission(ctx: ApiContext, permission: string): AuthedUser {
  const user = requireUser(ctx);
  if (!hasPermission(user, permission)) {
    throw new ApiError("Akses ditolak: permission tidak mencukupi.", "FORBIDDEN", 403);
  }
  return user;
}

export { ok, fail, ApiError };

/** Konversi error Zod ke ApiError dengan pesan aman. */
export function fromZodError(error: { issues: { path: (string | number)[]; message: string }[] }): ApiError {
  const first = error.issues[0];
  const path = first ? first.path.join(".") : "";
  const message = first ? `${path ? `${path}: ` : ""}${first.message}` : "Data tidak valid.";
  return new ApiError(message, "VALIDATION_ERROR", 400, {
    issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  });
}
