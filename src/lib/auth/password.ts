import bcrypt from "bcryptjs";

/** Cost bcrypt untuk custom password auth (12 sesuai requirement). */
export const BCRYPT_COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Dummy hash untuk membuat timing login serupa walau email tidak dikenal
 * (mencegah user enumeration via timing).
 */
export const DUMMY_HASH = bcrypt.hashSync("wangstore-dummy-password-untuk-timing", BCRYPT_COST);
