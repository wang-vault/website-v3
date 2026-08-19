import type { Metadata } from "next";
import { getPageBySlug, renderPageSections } from "@/lib/store/content";
import { SectionRenderer } from "@/components/sections";
import { ServerBuilder } from "@/components/builder/server-builder";

export const metadata: Metadata = {
  title: "Server Builder",
  description:
    "Rancang server Anda: pilih Tier, atur CPU, RAM, dan penyimpanan, lalu lihat harga dan estimasi performa secara real-time.",
};

export default async function ServerBuilderPage() {
  const page = await getPageBySlug("server-builder");
  const sections = renderPageSections(page?.sections);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {sections.length > 0 && <SectionRenderer sections={sections} />}
      <ServerBuilder />
    </div>
  );
}
