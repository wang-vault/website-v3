import type { ZodType } from "zod";
import {
  announcementSchema,
  blogPostSchema,
  faqSchema,
  incidentSchema,
  kbArticleSchema,
  legalDocumentSchema,
  maintenanceWindowSchema,
  pageSchema,
  testimonialSchema,
} from "@/lib/validation/admin";
import type { PageSection } from "@/lib/types";

/**
 * CMS GENERIC RESOURCE MAP — satu handler untuk banyak resource.
 * Setiap resource punya: collection (tabel), identity, schema validasi,
 * role minimum, dan daftar field yang boleh diedit.
 */
export interface CmsResource {
  key: string;
  collection: string;
  schema: ZodType;
  /** Field yang boleh diubah via PATCH (whitelist). */
  editableFields: string[];
  minRole: "owner" | "admin" | "staff";
  /** Slug unik per resource (untuk validasi duplikat). */
  slugField?: string;
  /** Post-process saat create/update (misal hitung reading time). */
  transform?: (data: Record<string, unknown>) => Record<string, unknown>;
}

const now = () => new Date().toISOString();

export const CMS_RESOURCES: CmsResource[] = [
  {
    key: "pages",
    collection: "pages",
    schema: pageSchema,
    editableFields: ["slug", "title", "seo_title", "seo_description", "sections", "status"],
    minRole: "admin",
    slugField: "slug",
  },
  {
    key: "faq",
    collection: "faq_items",
    schema: faqSchema,
    editableFields: ["question", "answer_md", "category", "sort", "status"],
    minRole: "staff",
  },
  {
    key: "testimonials",
    collection: "testimonials",
    schema: testimonialSchema,
    editableFields: ["name", "role", "content", "rating", "status"],
    minRole: "staff",
  },
  {
    key: "blog",
    collection: "blog_posts",
    schema: blogPostSchema,
    editableFields: [
      "title",
      "slug",
      "excerpt",
      "content_md",
      "category_id",
      "author_name",
      "status",
      "published_at",
      "seo_title",
      "seo_description",
      "reading_time",
    ],
    minRole: "staff",
    slugField: "slug",
    transform: (data) => {
      const words = String(data.content_md ?? "")
        .replace(/[#>*`_\-\[\]()!]/g, " ")
        .split(/\s+/)
        .filter(Boolean).length;
      return { ...data, reading_time: Math.max(1, Math.ceil(words / 200)) };
    },
  },
  {
    key: "knowledgeBase",
    collection: "knowledge_articles",
    schema: kbArticleSchema,
    editableFields: [
      "title",
      "slug",
      "excerpt",
      "content_md",
      "category",
      "author_name",
      "status",
      "published_at",
      "seo_title",
      "seo_description",
      "reading_time",
    ],
    minRole: "staff",
    slugField: "slug",
    transform: (data) => {
      const words = String(data.content_md ?? "")
        .replace(/[#>*`_\-\[\]()!]/g, " ")
        .split(/\s+/)
        .filter(Boolean).length;
      return { ...data, reading_time: Math.max(1, Math.ceil(words / 200)) };
    },
  },
  {
    key: "legal",
    collection: "legal_documents",
    schema: legalDocumentSchema,
    editableFields: ["slug", "title", "sections", "version"],
    minRole: "admin",
    slugField: "slug",
  },
  {
    key: "announcements",
    collection: "announcements",
    schema: announcementSchema,
    editableFields: ["title", "message_md", "status", "starts_at", "ends_at"],
    minRole: "staff",
  },
  {
    key: "incidents",
    collection: "incidents",
    schema: incidentSchema,
    editableFields: ["title", "message_md", "severity", "status", "started_at", "resolved_at"],
    minRole: "admin",
  },
  {
    key: "maintenance",
    collection: "maintenance_windows",
    schema: maintenanceWindowSchema,
    editableFields: ["title", "message", "starts_at", "ends_at", "status"],
    minRole: "admin",
  },
];

export function getCmsResource(key: string): CmsResource | null {
  return CMS_RESOURCES.find((r) => r.key === key) ?? null;
}

/** Mapping key CMS → nama kolom DB (kebab → snake). */
export function cmsColumnName(field: string): string {
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function toSections(value: unknown): PageSection[] {
  return Array.isArray(value) ? (value as PageSection[]) : [];
}

export const CMS_SECTION_TYPES = ["hero", "heading", "paragraph", "list", "cta", "card"] as const;

export { now as cmsNow };
