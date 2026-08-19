import { NextRequest, NextResponse } from "next/server";
import { buildCsrfCookieValue } from "@/lib/security";
import { randomToken } from "@/lib/utils";

/**
 * Middleware (edge):
 * - Header keamanan (CSP, HSTS, X-Frame-Options, dll.)
 * - Cookie CSRF double-submit (ws_csrf, HttpOnly, SameSite=Lax)
 * - noindex untuk rute privat
 * - OPTIONS preflight untuk API
 */

const PRIVATE_PREFIXES = ["/dashboard", "/admin", "/order/", "/account"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // Cookie CSRF
  const csrfCookie = request.cookies.get("ws_csrf");
  if (!csrfCookie?.value) {
    const token = randomToken(24);
    const signed = await buildCsrfCookieValue(token);
    response.cookies.set("ws_csrf", signed, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://challenges.cloudflare.com",
      "frame-src https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://wa.me",
    ].join("; "),
  );

  // noindex rute privat
  if (PRIVATE_PREFIXES.some((p) => pathname.startsWith(p))) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  // Preflight CORS (API dipakai same-origin; tolak lintas-origin tanpa origin valid)
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: response.headers });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)"],
};
