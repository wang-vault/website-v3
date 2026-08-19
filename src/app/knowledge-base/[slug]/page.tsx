import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { Markdown } from "@/components/markdown";
import { formatDate } from "@/lib/utils/format";
import type { KnowledgeArticle } from "@/lib/types";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const article = await table<KnowledgeArticle>("knowledge_articles", getDriver()).findOne({ slug: params.slug, status: "published" });
  if (!article) return { title: "Artikel tidak ditemukan" };
  return { title: article.seo_title || article.title, description: article.seo_description || article.excerpt };
}

export default async function KnowledgeArticlePage({ params }: { params: { slug: string } }) {
  const driver = getDriver();
  const article = await table<KnowledgeArticle>("knowledge_articles", driver).findOne({ slug: params.slug });
  if (!article || article.status !== "published") notFound();
  const related = (
    await table<KnowledgeArticle>("knowledge_articles", driver).find(
      { status: "published", category: article.category },
      { orderBy: [{ column: "published_at", dir: "desc" }], limit: 4 },
    )
  )
    .filter((r) => r.id !== article.id)
    .slice(0, 3);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/knowledge-base" className="text-sm text-muted hover:text-primary">← Kembali ke Knowledge Base</Link>
      <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted">
        <Link
          href={`/knowledge-base?category=${encodeURIComponent(article.category)}`}
          className="rounded-full border border-border px-2.5 py-0.5 font-medium text-secondary hover:bg-surface-muted"
        >
          {article.category}
        </Link>
        <span>·</span>
        <time dateTime={article.published_at ?? undefined}>{article.published_at ? formatDate(article.published_at) : ""}</time>
        <span>·</span>
        <span>{article.reading_time} menit baca</span>
      </div>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{article.title}</h1>
      <div className="mt-8 border-t border-border pt-8">
        <Markdown content={article.content_md} />
      </div>

      {related.length > 0 && (
        <aside className="mt-12 rounded-2xl border border-border bg-surface p-6" aria-label="Artikel terkait">
          <h2 className="text-base font-semibold">Artikel Terkait</h2>
          <ul className="mt-3 space-y-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link href={`/knowledge-base/${r.slug}`} className="text-sm font-medium hover:underline">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </article>
  );
}
