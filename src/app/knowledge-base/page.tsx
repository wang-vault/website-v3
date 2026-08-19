import type { Metadata } from "next";
import Link from "next/link";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { EmptyState } from "@/components/ui/state";
import { KbSearch } from "@/components/kb-search";
import type { KnowledgeArticle } from "@/lib/types";

export const metadata: Metadata = {
  title: "Knowledge Base",
  description: "Panduan lengkap WangStore: memulai, pemesanan, pembayaran, server, troubleshooting, akun, dan kebijakan.",
};

export const revalidate = 60;


export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string };
}) {
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const category = searchParams.category ?? "";
  const driver = getDriver();
  const rows = await table<KnowledgeArticle>("knowledge_articles", driver).find(
    { status: "published" },
    { orderBy: [{ column: "published_at", dir: "desc" }], limit: 500 },
  );

  const filtered = rows.filter((a) => {
    const text = `${a.title} ${a.excerpt} ${a.content_md} ${a.category}`.toLowerCase();
    return (!q || text.includes(q)) && (!category || a.category === category);
  });
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Knowledge Base</h1>
      <p className="mt-2 text-secondary">Panduan langkah demi langkah untuk memulai, memesan, dan memecahkan masalah.</p>

      <KbSearch />

      {filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Belum ada artikel"
            description={q ? "Tidak ada artikel yang cocok dengan pencarian Anda." : "Artikel akan tampil di sini setelah dipublikasikan."}
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <Link key={a.id} href={`/knowledge-base/${a.slug}`} className="group rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-surface-muted">
              <span className="text-xs font-medium text-muted">{a.category}</span>
              <h2 className="mt-2 text-base font-semibold leading-snug group-hover:underline">{a.title}</h2>
              <p className="mt-2 line-clamp-2 text-sm text-secondary">{a.excerpt}</p>
              <p className="mt-3 text-xs text-muted">{a.reading_time} menit baca</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
