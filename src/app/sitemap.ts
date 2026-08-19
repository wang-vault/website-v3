import type { MetadataRoute } from "next";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { BlogPost, KnowledgeArticle } from "@/lib/types";

const STATIC_ROUTES = [
  "",
  "/about",
  "/infrastructure",
  "/server-builder",
  "/features",
  "/why-wangstore",
  "/faq",
  "/testimonials",
  "/blog",
  "/knowledge-base",
  "/status",
  "/contact",
  "/terms",
  "/privacy",
  "/refund",
  "/sla",
  "/acceptable-use",
  "/cookie-policy",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${base}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : route === "/server-builder" ? 0.9 : 0.7,
  }));

  try {
    const driver = getDriver();
    const [posts, articles] = await Promise.all([
      table<BlogPost>("blog_posts", driver).find({ status: "published" }, { limit: 500 }),
      table<KnowledgeArticle>("knowledge_articles", driver).find({ status: "published" }, { limit: 500 }),
    ]);
    for (const post of posts) {
      entries.push({
        url: `${base}/blog/${post.slug}`,
        lastModified: post.published_at ? new Date(post.published_at) : now,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
    for (const article of articles) {
      entries.push({
        url: `${base}/knowledge-base/${article.slug}`,
        lastModified: article.published_at ? new Date(article.published_at) : now,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch {
    // sitemap tetap tersedia dengan rute statis bila DB belum siap
  }

  return entries;
}
