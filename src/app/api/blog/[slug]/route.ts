import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { BlogCategory, BlogPost } from "@/lib/types";

/** GET /api/blog/[slug] — artikel + related (kategori sama). */
export const GET = api({
  methods: ["GET"],
  handler: async ({ params }) => {
    const driver = getDriver();
    const post = await table<BlogPost>("blog_posts", driver).findOne({ slug: params.slug });
    if (!post || post.status !== "published") {
      return Response.json({ success: false, error: { code: "NOT_FOUND", message: "Artikel tidak ditemukan." } }, { status: 404 });
    }
    const [category, related] = await Promise.all([
      post.category_id ? table<BlogCategory>("blog_categories", driver).findById(String(post.category_id)) : null,
      table<BlogPost>("blog_posts", driver).find(
        { status: "published", category_id: post.category_id ?? "" },
        { orderBy: [{ column: "published_at", dir: "desc" }], limit: 4 },
      ),
    ]);
    return Response.json({
      success: true,
      data: {
        post,
        category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
        related: related
          .filter((r) => r.id !== post.id)
          .slice(0, 3)
          .map((r) => ({ id: r.id, title: r.title, slug: r.slug, excerpt: r.excerpt, publishedAt: r.published_at })),
      },
    });
  },
});
