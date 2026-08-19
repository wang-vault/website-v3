import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { BlogCategory, BlogPost, BlogTag } from "@/lib/types";

/** GET /api/blog?q=&category=&tag=&page=&pageSize= — daftar + pencarian. */
export const GET = api({
  methods: ["GET"],
  handler: async ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const category = url.searchParams.get("category") ?? "";
    const tag = url.searchParams.get("tag") ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? 12) || 12));

    const driver = getDriver();
    const posts = table<BlogPost>("blog_posts", driver);
    const baseWhere: Record<string, unknown> = { status: "published" };
    const where: Record<string, unknown> = { ...baseWhere };
    if (category) {
      const cat = await table<BlogCategory>("blog_categories", driver).findOne({ slug: category });
      if (cat) where.category_id = cat.id;
    }

    let rows = await posts.find(where, { orderBy: [{ column: "published_at", dir: "desc" }], limit: 200 });
    let total = rows.length;

    // Search: title, excerpt, content, tags, category (di TS agar konsisten antar driver)
    if (q || tag) {
      rows = rows.filter((p) => {
        const text = `${p.title} ${p.excerpt} ${p.content_md}`.toLowerCase();
        return (!q || text.includes(q)) && (!tag || String(p.tags ?? "").includes(tag));
      });
      total = rows.length;
    }

    const offset = (page - 1) * pageSize;
    const pageRows = rows.slice(offset, offset + pageSize);

    const [categories, tags] = await Promise.all([
      table<BlogCategory>("blog_categories", driver).all({ orderBy: [{ column: "name", dir: "asc" }] }),
      table<BlogTag>("blog_tags", driver).all({ orderBy: [{ column: "name", dir: "asc" }] }),
    ]);

    return Response.json({
      success: true,
      data: {
        posts: pageRows.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          excerpt: p.excerpt,
          author: p.author_name,
          categoryId: p.category_id,
          publishedAt: p.published_at,
          readingTime: p.reading_time,
        })),
        categories,
        tags,
        total,
        page,
        pageSize,
      },
    });
  },
});
