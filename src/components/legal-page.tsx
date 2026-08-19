import type { Metadata } from "next";
import { getLegalDocument } from "@/lib/store/content";
import { SectionRenderer } from "@/components/sections";
import { notFound } from "next/navigation";

export async function LegalPage({ slug }: { slug: string }) {
  const doc = await getLegalDocument(slug);
  if (!doc) notFound();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Dokumen Hukum</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{doc.title}</h1>
      <p className="mt-1 text-xs text-muted">
        Versi {doc.version} · Terakhir diperbarui {new Date(doc.updated_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
      </p>
      <div className="mt-8">
        <SectionRenderer sections={Array.isArray(doc.sections) ? doc.sections : []} />
      </div>
    </div>
  );
}

export async function legalMetadata(slug: string): Promise<Metadata> {
  const doc = await getLegalDocument(slug);
  if (!doc) return { title: "Dokumen tidak ditemukan" };
  return { title: doc.title, description: `Dokumen hukum ${doc.title} WangStore.` };
}
