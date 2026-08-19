/**
 * db:seed — mengisi data awal (roles, permission, tier, pricing rules,
 * konten CMS, blog, knowledge base, FAQ, dll.) secara idempotent.
 * Contoh: npm run db:seed
 */
import postgres from "postgres";
import { getSeedData, SEED_IDS } from "../src/lib/db/seed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL belum diatur. Jalankan npm run db:migrate terlebih dahulu, lalu isi DATABASE_URL.",
    );
    process.exit(1);
  }
  const sql = postgres(url, {
    max: 1,
    ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
  });
  const data = getSeedData();
  const upsertOrder = [
    "roles",
    "permissions",
    "role_permissions",
    "server_tiers",
    "pricing_rules",
    "settings",
    "pages",
    "legal_documents",
    "faq_items",
    "blog_categories",
    "blog_tags",
    "blog_posts",
    "knowledge_articles",
    "announcements",
  ];
  try {
    for (const tableName of upsertOrder) {
      const rows = data[tableName] ?? [];
      let inserted = 0;
      for (const row of rows) {
        const cols = Object.keys(row);
        const values = cols.map((c) => row[c]);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        const colSql = cols.map((c) => `"${c}"`).join(", ");
        const conflict = tableName === "roles" ? `"slug"` : tableName === "permissions" ? `"key"` : tableName === "server_tiers" ? `"slug"` : tableName === "pricing_rules" ? `"tier_id"` : tableName === "settings" ? `"key"` : tableName === "pages" ? `"slug"` : tableName === "legal_documents" ? `"slug"` : tableName === "faq_items" ? `"id"` : tableName === "blog_categories" ? `"slug"` : tableName === "blog_tags" ? `"slug"` : tableName === "blog_posts" ? `"slug"` : tableName === "knowledge_articles" ? `"slug"` : tableName === "announcements" ? `"id"` : `"id"`;
        const updateSet = cols
          .filter((c) => c !== conflict.replace(/"/g, ""))
          .map((c) => `"${c}" = EXCLUDED."${c}"`)
          .join(", ");
        const res = await sql.unsafe(
          `INSERT INTO "${tableName}" (${colSql}) VALUES (${placeholders})
           ON CONFLICT (${conflict}) DO UPDATE SET ${updateSet || `"id" = EXCLUDED."id"`}
           RETURNING "id"`,
          values as never[],
        );
        if (res.length > 0) inserted++;
      }
      console.log(`  ${tableName}: ${inserted}/${rows.length} baris tersedia`);
    }
    console.log("\nSeed selesai. Catatan:");
    console.log("  - User pertama yang mendaftar otomatis menjadi OWNER.");
    console.log("  - Testimoni/insiden/jadwal maintenance sengaja KOSONG (jangan isi data palsu).");
    console.log(`  - Role customer: ${SEED_IDS.roleCustomer}`);
  } catch (e) {
    console.error("Seed gagal:", e instanceof Error ? e.message : e);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();
