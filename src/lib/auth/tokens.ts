import { createHash } from "crypto";
import { jwtVerify, SignJWT } from "jose";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { newId, nowIso } from "@/lib/utils";
import { ApiError } from "@/lib/security";

/**
 * Token verifikasi email & reset password:
 * - JWT (jose) yang ditandatangani AUTH_SECRET
 * - time-limited (verify: 24 jam, reset: 1 jam)
 * - single-use: jti dicatat di tabel auth_tokens; token kedua kali ditolak
 */

export type TokenPurpose = "verify_email" | "reset_password";

const TTL: Record<TokenPurpose, number> = {
  verify_email: 24 * 3600,
  reset_password: 3600,
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret === "please-change-me-to-a-long-random-secret") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET belum dikonfigurasi. Set AUTH_SECRET dengan nilai acak yang panjang.");
    }
  }
  return new TextEncoder().encode(secret ?? "wangstore-dev-secret");
}

export async function createAuthToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const jti = newId();
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ purpose, sub: userId, jti })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + TTL[purpose])
    .sign(secretKey());

  await table("auth_tokens", getDriver()).insert({
    id: jti,
    user_id: userId,
    purpose,
    token_hash: hashToken(token),
    expires_at: new Date((now + TTL[purpose]) * 1000).toISOString(),
    used_at: null,
    created_at: nowIso(),
  });
  return token;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

interface VerifiedToken {
  userId: string;
  purpose: TokenPurpose;
  jti: string;
}

/** Verifikasi + tandai used (single-use, atomik-ish via DB unique). */
export async function consumeAuthToken(token: string, expectedPurpose: TokenPurpose): Promise<VerifiedToken> {
  let payload: { sub?: string; purpose?: string; jti?: string };
  try {
    const result = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    payload = result.payload as { sub?: string; purpose?: string; jti?: string };
  } catch {
    throw new ApiError("Tautan tidak valid atau sudah kedaluwarsa.", "TOKEN_INVALID", 400);
  }
  if (payload.purpose !== expectedPurpose || !payload.sub || !payload.jti) {
    throw new ApiError("Tautan tidak valid.", "TOKEN_INVALID", 400);
  }
  const stored = await table("auth_tokens", getDriver()).findOne({
    token_hash: hashToken(token),
    purpose: expectedPurpose,
  });
  if (!stored) {
    throw new ApiError("Tautan tidak valid atau sudah digunakan.", "TOKEN_USED", 400);
  }
  if (stored.used_at) {
    throw new ApiError("Tautan sudah digunakan.", "TOKEN_USED", 400);
  }
  if (new Date(String(stored.expires_at)).getTime() <= Date.now()) {
    throw new ApiError("Tautan sudah kedaluwarsa.", "TOKEN_EXPIRED", 400);
  }
  await table("auth_tokens", getDriver()).update(stored.id as string, { used_at: nowIso() });
  return { userId: payload.sub, purpose: payload.purpose as TokenPurpose, jti: payload.jti };
}
