import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { Markdown } from "@/components/markdown";
import { formatDate } from "@/lib/utils/format";
import type { BlogCategory, BlogPost } from "@/lib/types";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await table<BlogPost>("blog_posts", getDriver()).findOne({ slug: params.slug, status: "published" });
  if (!post) return { title: "Artikel tidak ditemukan" };
  return {
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt,
    openGraph: { type: "article", publishedTime: post.published_at ?? undefined, authors: [post.author_name] },
  };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const driver = getDriver();
  const post = await table<BlogPost>("blog_posts", driver).findOne({ slug: params.slug });
  if (!post || post.status !== "published") notFound();
  const category = post.category_id
    ? await table<BlogCategory>("blog_categories", driver).findById(String(post.category_id))
    : null;
  const related = (
    await table<BlogPost>("blog_posts", driver).find(
      { status: "published", category_id: post.category_id ?? "" },
      { orderBy: [{ column: "published_at", dir: "desc" }], limit: 4 },
    )
  )
    .filter((r) => r.id !== post.id)
    .slice(0, 3);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/blog" className="text-sm text-muted hover:text-primary">← Kembali ke Blog</Link>
      <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted">
        {category && (
          <Link href={`/blog?category=${category.slug}`} className="rounded-full border border-border px-2.5 py-0.5 font-medium text-secondary hover:bg-surface-muted">
            {category.name}
          </Link>
        )}
        <span>·</span>
        <time dateTime={post.published_at ?? undefined}>{post.published_at ? formatDate(post.published_at) : ""}</time>
        <span>·</span>
        <span>{post.reading_time} menit baca</span>
      </div>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{post.title}</h1>
      <p className="mt-3 text-lg text-secondary">{post.excerpt}</p>
      <p className="mt-4 text-sm text-muted">Oleh {post.author_name}</p>
      <div className="mt-8 border-t border-border pt-8">
        <Markdown content={post.content_md} />
      </div>

      {related.length > 0 && (
        <aside className="mt-12 rounded-2xl border border-border bg-surface p-6" aria-label="Artikel terkait">
          <h2 className="text-base font-semibold">Artikel Terkait</h2>
          <ul className="mt-3 space-y-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link href={`/blog/${r.slug}`} className="text-sm font-medium hover:underline">
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
