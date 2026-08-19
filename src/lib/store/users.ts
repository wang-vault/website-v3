import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { newId, nowIso } from "@/lib/utils";
import { hashPassword } from "@/lib/auth/password";
import type { Profile, Role, User } from "@/lib/types";
import { ApiError } from "@/lib/security";
import { auditLog } from "@/lib/audit";
import { SEED_IDS } from "@/lib/db/seed";

export interface RegisterUserInput {
  email: string;
  password: string;
  fullName: string;
  whatsapp?: string;
  ip?: string | null;
}

/**
 * Registrasi: user pertama yang mendaftar otomatis menjadi OWNER
 * (agar deployment bisa langsung dikelola). Didokumentasikan di README.
 */
export async function registerUser(input: RegisterUserInput): Promise<User> {
  const driver = getDriver();
  const users = table<User>("users", driver);
  const existing = await users.findOne({ email: input.email });
  if (existing) {
    throw new ApiError("Email sudah terdaftar.", "EMAIL_TAKEN", 409);
  }
  const ownerCount = await users.count({
    role_id: SEED_IDS.roleOwner,
  });
  const roleId = ownerCount === 0 ? SEED_IDS.roleOwner : await ensureCustomerRole();
  const passwordHash = await hashPassword(input.password);
  const now = nowIso();

  const user: User = {
    id: newId(),
    email: input.email,
    password_hash: passwordHash,
    email_verified_at: null,
    role_id: roleId,
    status: "active",
    last_login_at: null,
    last_login_ip: null,
    created_at: now,
    updated_at: now,
  };
  await driver.tx(async (tx) => {
    await table<User>("users", tx).insert(user);
    await table<Profile>("profiles", tx).insert({
      id: newId(),
      user_id: user.id,
      full_name: input.fullName,
      whatsapp: input.whatsapp ?? "",
      discord: "",
      bio: "",
      created_at: now,
      updated_at: now,
    });
  });

  await auditLog({
    actorType: "user",
    actorId: user.id,
    actorEmail: user.email,
    action: "create",
    resource: "user",
    resourceId: user.id,
    ip: input.ip ?? null,
    metadata: { role: roleId === SEED_IDS.roleOwner ? "owner (user pertama)" : "user" },
  });
  return user;
}

/**
 * Role pelanggan (non-sistem, tanpa permission admin) dibuat otomatis agar
 * RBAC tetap benar: pelanggan tidak punya akses ke modul admin mana pun.
 * Role ini juga di-seed di database/schema.sql + seed untuk Postgres.
 */
export async function ensureCustomerRole(): Promise<string> {
  const driver = getDriver();
  const roles = table<Role>("roles", driver);
  let role = await roles.findOne({ slug: "customer" });
  if (!role) {
    const now = nowIso();
    role = {
      id: newId(),
      slug: "customer",
      name: "Pelanggan",
      description: "Akun pelanggan biasa tanpa akses admin.",
      is_system: false,
      created_at: now,
      updated_at: now,
    };
    await roles.insert(role);
  }
  const saved = await roles.findOne({ slug: "customer" });
  if (!saved) throw new ApiError("Gagal menyiapkan role pelanggan.", "ROLE_CONFIG_ERROR", 500);
  return saved.id;
}
