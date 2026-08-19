import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { KnowledgeArticle } from "@/lib/types";

export const GET = api({
  methods: ["GET"],
  handler: async ({ params }) => {
    const driver = getDriver();
    const article = await table<KnowledgeArticle>("knowledge_articles", driver).findOne({ slug: params.slug });
    if (!article || article.status !== "published") {
      return Response.json({ success: false, error: { code: "NOT_FOUND", message: "Artikel tidak ditemukan." } }, { status: 404 });
    }
    const related = await table<KnowledgeArticle>("knowledge_articles", driver).find(
      { status: "published", category: article.category },
      { orderBy: [{ column: "published_at", dir: "desc" }], limit: 4 },
    );
    return Response.json({
      success: true,
      data: {
        article,
        related: related.filter((r) => r.id !== article.id).slice(0, 3).map((r) => ({ id: r.id, title: r.title, slug: r.slug })),
      },
    });
  },
});
