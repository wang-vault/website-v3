import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { FaqItem, LegalDocument, Page } from "@/lib/types";

export async function getPageBySlug(slug: string): Promise<Page | null> {
  const row = await table<Page>("pages", getDriver()).findOne({ slug, status: "active" });
  return row ?? null;
}

export async function getLegalDocument(slug: string): Promise<LegalDocument | null> {
  return table<LegalDocument>("legal_documents", getDriver()).findOne({ slug });
}

export async function getActiveFaqs(): Promise<FaqItem[]> {
  return table<FaqItem>("faq_items", getDriver()).find(
    { status: "active" },
    { orderBy: [{ column: "sort", dir: "asc" }] },
  );
}

export function renderPageSections(sections: unknown): Page["sections"] {
  if (!Array.isArray(sections)) return [];
  return sections as Page["sections"];
}
