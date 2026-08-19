import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { KnowledgeArticle } from "@/lib/types";

const KB_CATEGORIES = ["Memulai", "Pemesanan", "Pembayaran", "Minecraft", "Server", "Troubleshooting", "Akun", "Kebijakan"];

/** GET /api/knowledge-base?q=&category=&page= — daftar + pencarian artikel. */
export const GET = api({
  methods: ["GET"],
  handler: async ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const category = url.searchParams.get("category") ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? 12) || 12));

    const rows = await table<KnowledgeArticle>("knowledge_articles", getDriver()).find(
      { status: "published" },
      { orderBy: [{ column: "published_at", dir: "desc" }], limit: 500 },
    );
    const filtered = rows.filter((a) => {
      const text = `${a.title} ${a.excerpt} ${a.content_md} ${a.category}`.toLowerCase();
      return (!q || text.includes(q)) && (!category || a.category === category);
    });
    const offset = (page - 1) * pageSize;
    return Response.json({
      success: true,
      data: {
        articles: filtered.slice(offset, offset + pageSize).map((a) => ({
          id: a.id,
          title: a.title,
          slug: a.slug,
          excerpt: a.excerpt,
          category: a.category,
          publishedAt: a.published_at,
          readingTime: a.reading_time,
        })),
        categories: KB_CATEGORIES.filter((c) => rows.some((r) => r.category === c)),
        total: filtered.length,
        page,
        pageSize,
      },
    });
  },
});
