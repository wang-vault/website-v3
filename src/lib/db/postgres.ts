import postgres from "postgres";
import type { Sql, TransactionSql } from "postgres";
import type { QueryResult, Row, SqlDriver } from "@/lib/db/types";

/**
 * Driver PostgreSQL untuk production/cloud (Vercel + Supabase/Neon/Railway/dll).
 * Serverless-friendly: koneksi singleton global, pool kecil, tanpa filesystem.
 */

let globalSql: Sql | null = null;

function getSql(): Sql {
  if (globalSql) return globalSql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Konfigurasi database tidak lengkap: DATABASE_URL belum diatur untuk environment ini.",
    );
  }
  const ssl = process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false };
  globalSql = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl,
    connection: { application_name: "wangstore" },
  });
  return globalSql;
}

/** Minimal interface yang dipakai driver (Sql dan TransactionSql sama-sama memenuhinya). */
interface PgExec {
  unsafe(q: string, params?: unknown[]): Promise<unknown>;
  begin<T>(fn: (tx: TransactionSql) => Promise<T>): Promise<T>;
  end(opts?: { timeout?: number }): Promise<void>;
}

async function run<T extends Row = Row>(sql: PgExec, q: string, params: unknown[]): Promise<QueryResult<T>> {
  const rows = (await sql.unsafe(q, params)) as unknown as T[];
  return { rows, rowCount: rows.length };
}

function driverFor(sql: PgExec): SqlDriver {
  return {
    async query<T extends Row = Row>(q: string, params: unknown[]): Promise<QueryResult<T>> {
      return run<T>(sql, q, params);
    },
    async execute<T extends Row = Row>(q: string, params: unknown[]): Promise<QueryResult<T>> {
      return run<T>(sql, q, params);
    },
    async tx<T>(fn: (d: SqlDriver) => Promise<T>): Promise<T> {
      return sql.begin(async (tx) => {
        const txDriver = driverFor(tx as unknown as PgExec);
        return fn(txDriver);
      });
    },
    async close() {
      await sql.end({ timeout: 5 });
      globalSql = null;
    },
  };
}

export function createPostgresDriver(): SqlDriver {
  return driverFor(getSql() as unknown as PgExec);
}
