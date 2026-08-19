import type { Metadata } from "next";
import { getPageBySlug, renderPageSections } from "@/lib/store/content";
import { SectionRenderer } from "@/components/sections";
import { notFound } from "next/navigation";

/** Halaman statis berbasis CMS (sections dari database). */
export async function CmsPage({ slug }: { slug: string }) {
  const page = await getPageBySlug(slug);
  if (!page) notFound();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <SectionRenderer sections={renderPageSections(page.sections)} />
    </div>
  );
}

export async function cmsPageMetadata(slug: string): Promise<Metadata> {
  const page = await getPageBySlug(slug);
  if (!page) return { title: "Halaman tidak ditemukan" };
  return {
    title: page.seo_title || page.title,
    description: page.seo_description ?? undefined,
  };
}
