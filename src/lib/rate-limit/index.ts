/**
 * Rate limiting serverless-compatible (per-instance, in-memory).
 *
 * Catatan jujur: pada deployment Vercel, batas ini berlaku per instance
 * lambda dan tidak bersifat global. Untuk perlindungan global gunakan
 * Cloudflare (atau provider edge) sebagai lapisan tambahan.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_BUCKETS = 50_000;

function keyFor(ip: string, route: string, userId?: string): string {
  return userId ? `${ip}:${userId}:${route}` : `${ip}:${route}`;
}

function cleanup(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

/**
 * Cek & catat hit. `limit` = jumlah maksimum dalam satu window (60 detik).
 */
export function rateLimit(opts: { ip: string; route: string; limit: number; userId?: string }): RateLimitResult {
  const now = Date.now();
  cleanup(now);
  const key = keyFor(opts.ip, opts.route, opts.userId);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, limit: opts.limit, remaining: opts.limit - 1, resetAt: now + WINDOW_MS, retryAfterSec: 0 };
  }
  bucket.count += 1;
  const remaining = Math.max(0, opts.limit - bucket.count);
  const retryAfterSec = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000));
  if (bucket.count > opts.limit) {
    return { ok: false, limit: opts.limit, remaining: 0, resetAt: bucket.resetAt, retryAfterSec };
  }
  return { ok: true, limit: opts.limit, remaining, resetAt: bucket.resetAt, retryAfterSec };
}

export const RATE_LIMITS = {
  login: 10,
  register: 5,
  resetPassword: 5,
  verifyEmail: 10,
  order: 5,
  contact: 5,
  estimate: 30,
  couponValidate: 20,
  general: 120,
  admin: 300,
} as const;

/** Reset seluruh bucket (dipakai test agar antar-test tidak saling memengaruhi). */
export function resetRateLimits(): void {
  buckets.clear();
}
