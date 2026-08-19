/**
 * db:migrate — menjalankan database/schema.sql ke PostgreSQL cloud.
 * Contoh: npm run db:migrate
 * (Membutuhkan DATABASE_URL di environment.)
 */
import { readFile } from "fs/promises";
import path from "path";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL belum diatur. Salin .env.example ke .env.local lalu isi koneksi PostgreSQL cloud Anda.",
    );
    process.exit(1);
  }
  const sql = postgres(url, {
    max: 1,
    ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
  });
  try {
    const schema = await readFile(path.join(process.cwd(), "database", "schema.sql"), "utf8");
    console.log("Menjalankan database/schema.sql …");
    await sql.unsafe(schema);
    console.log("Schema berhasil diterapkan.");
  } catch (e) {
    console.error("Migrasi gagal:", e instanceof Error ? e.message : e);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();
