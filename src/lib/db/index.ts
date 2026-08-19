import { createPostgresDriver } from "@/lib/db/postgres";
import { createJsonDriver } from "@/lib/db/json";
import type { SqlDriver } from "@/lib/db/types";

/**
 * Pemilihan datastore:
 * - DATABASE_URL terisi        → PostgreSQL cloud/serverless (production/preview/dev).
 * - DATABASE_URL kosong:
 *   - NODE_ENV=development     → JSON datastore lokal (fallback development SAJA).
 *   - production/preview       → GAGAL EKSPLISIT (tidak ada fallback diam-diam).
 */

let cached: SqlDriver | null = null;
let cacheKey = "";

export function getDriver(): SqlDriver {
  const dbUrl = process.env.DATABASE_URL ?? "";
  const env = process.env.NODE_ENV;
  const isLocal = env === "development" || env === "test";
  // Saat `next build` (static generation), halaman diprerender dengan data
  // awal dari JSON fallback agar build berhasil tanpa DATABASE_URL.
  // Pada RUNTIME production/preview, fallback TIDAK pernah aktif — gagal eksplisit.
  const isBuildPhase = env === "production" && process.env.NEXT_PHASE === "phase-production-build";
  const key = `${dbUrl ? "pg" : "json"}:${isLocal || isBuildPhase ? "local" : "prod"}`;
  if (cached && cacheKey === key) return cached;

  if (dbUrl) {
    cached = createPostgresDriver();
    cacheKey = key;
    return cached;
  }
  if (isLocal || isBuildPhase) {
    const dataDir = process.env.WANGSTORE_DATA_DIR;
    cached = dataDir ? createJsonDriver(dataDir) : createJsonDriver();
    cacheKey = key;
    return cached;
  }
  throw new Error(
    "Konfigurasi database tidak lengkap: DATABASE_URL belum diatur. " +
      "Production dan Preview membutuhkan PostgreSQL cloud (mis. Supabase/Neon). " +
      "JSON datastore hanya tersedia untuk local development/testing/build.",
  );
}

/** Reset cache (dipakai di test). */
export function resetDriver(): void {
  cached = null;
  cacheKey = "";
}

export function usingJsonFallback(): boolean {
  return !process.env.DATABASE_URL && ["development", "test"].includes(process.env.NODE_ENV ?? "");
}
