import type { Metadata } from "next";
import Link from "next/link";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { formatDate } from "@/lib/utils/format";
import { EmptyState } from "@/components/ui/state";
import { BlogSearch } from "@/components/blog-search";
import type { BlogCategory, BlogPost } from "@/lib/types";

export const metadata: Metadata = {
  title: "Blog",
  description: "Artikel dan pengumuman dari WangStore: panduan, tips, dan kabar platform.",
};

export const revalidate = 60;

export default async function BlogPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string };
}) {
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const categorySlug = searchParams.category ?? "";
  const driver = getDriver();
  const [posts, categories] = await Promise.all([
    table<BlogPost>("blog_posts", driver).find({ status: "published" }, { orderBy: [{ column: "published_at", dir: "desc" }], limit: 200 }),
    table<BlogCategory>("blog_categories", driver).all({ orderBy: [{ column: "name", dir: "asc" }] }),
  ]);
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const activeCategory = categories.find((c) => c.slug === categorySlug);

  const filtered = posts.filter((p) => {
    const text = `${p.title} ${p.excerpt} ${p.content_md}`.toLowerCase();
    return (!q || text.includes(q)) && (!activeCategory || p.category_id === activeCategory.id);
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Blog</h1>
      <p className="mt-2 text-secondary">Panduan, tips, dan pengumuman dari tim WangStore.</p>

      <BlogSearch />

      <div className="mt-8 flex flex-wrap gap-2" role="list" aria-label="Kategori blog">
        <Link
          href="/blog"
          className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${!activeCategory ? "border-accent bg-accent text-bg" : "border-border text-secondary hover:bg-surface-muted"}`}
        >
          Semua
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/blog?category=${c.slug}`}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${activeCategory?.id === c.id ? "border-accent bg-accent text-bg" : "border-border text-secondary hover:bg-surface-muted"}`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Belum ada artikel"
            description={q ? "Tidak ada artikel yang cocok dengan pencarian Anda." : "Artikel akan tampil di sini setelah dipublikasikan."}
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {filtered.map((post) => {
            const cat = post.category_id ? categoryMap.get(post.category_id) : null;
            return (
              <article key={post.id} className="flex flex-col rounded-2xl border border-border bg-surface p-6 transition-colors hover:bg-surface-muted">
                <div className="flex items-center gap-2 text-xs text-muted">
                  {cat && <Link href={`/blog?category=${cat.slug}`} className="font-medium text-secondary hover:underline">{cat.name}</Link>}
                  <span aria-hidden>·</span>
                  <time dateTime={post.published_at ?? undefined}>{post.published_at ? formatDate(post.published_at) : ""}</time>
                  <span aria-hidden>·</span>
                  <span>{post.reading_time} menit baca</span>
                </div>
                <h2 className="mt-3 text-lg font-semibold leading-snug">
                  <Link href={`/blog/${post.slug}`} className="hover:underline">{post.title}</Link>
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-secondary">{post.excerpt}</p>
                <p className="mt-4 text-xs text-muted">{post.author_name}</p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
