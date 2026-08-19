import { createHash } from "crypto";
import { cookies } from "next/headers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { newId, nowIso, randomToken } from "@/lib/utils";
import { SESSION_COOKIE } from "@/lib/security";
import type { AuthedUser, Permission, Profile, Role, RolePermission, User } from "@/lib/types";

const SESSION_DAYS = 30;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Buat sesi baru; mengembalikan token mentah (disimpan hashed di DB). */
export async function createSession(input: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; expiresAt: string }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await table("sessions", getDriver()).insert({
    id: newId(),
    user_id: input.userId,
    token_hash: hashToken(token),
    expires_at: expiresAt,
    ip: input.ip ?? null,
    user_agent: input.userAgent ?? null,
    last_seen_at: nowIso(),
    revoked_at: null,
    created_at: nowIso(),
  });
  return { token, expiresAt };
}

export function setSessionCookie(token: string, expiresAt: string): void {
  try {
    const isProd = process.env.NODE_ENV === "production";
    cookies().set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      expires: new Date(expiresAt),
    });
  } catch {
    // Di luar request scope (test/CLI) — cookie di-set lewat response header oleh pemanggil.
  }
}

export function clearSessionCookie(): void {
  cookies().set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

export async function revokeSession(token: string): Promise<void> {
  await table("sessions", getDriver()).updateWhere(
    { token_hash: hashToken(token) },
    { revoked_at: nowIso() },
  );
}

async function loadUserWithRole(userId: string): Promise<AuthedUser | null> {
  const driver = getDriver();
  const user = await table<User>("users", driver).findById(userId);
  if (!user || user.status !== "active") return null;
  const role = await table<Role>("roles", driver).findById(user.role_id);
  if (!role) return null;
  // Dua langkah (portable antara Postgres & JSON fallback — tanpa JOIN).
  const rolePerms = await table<RolePermission>("role_permissions", driver).find({ role_id: role.id });
  const permIds = rolePerms.map((rp) => rp.permission_id);
  const perms = permIds.length
    ? await table<Permission>("permissions", driver).find({ id: { op: "in", value: permIds } })
    : [];
  const profile = await table<Profile>("profiles", driver).findOne({ user_id: user.id });
  return {
    id: user.id,
    email: user.email,
    emailVerified: !!user.email_verified_at,
    roleId: role.id,
    roleSlug: role.slug,
    roleName: role.name,
    permissions: new Set(perms.map((r) => r.key)),
    profile: {
      fullName: profile?.full_name ?? "",
      whatsapp: profile?.whatsapp ?? "",
      discord: profile?.discord ?? "",
    },
  };
}

/** Baca user dari cookie sesi (tanpa melempar). */
export async function getSessionUser(): Promise<AuthedUser | null> {
  try {
    const token = cookies().get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const session = await table("sessions", getDriver()).findOne({ token_hash: hashToken(token) });
    if (!session) return null;
    if (session.revoked_at) return null;
    if (new Date(String(session.expires_at)).getTime() <= Date.now()) return null;
    return loadUserWithRole(String(session.user_id));
  } catch {
    return null;
  }
}

/** Baca user dari header Authorization (dipakai API internal/test). */
export async function getUserFromHeader(request: Request): Promise<AuthedUser | null> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const session = await table("sessions", getDriver()).findOne({ token_hash: hashToken(token) });
  if (!session || session.revoked_at) return null;
  if (new Date(String(session.expires_at)).getTime() <= Date.now()) return null;
  return loadUserWithRole(String(session.user_id));
}

export function hasPermission(user: AuthedUser, permission: string): boolean {
  return user.permissions.has(permission);
}
