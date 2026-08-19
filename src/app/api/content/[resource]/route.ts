import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { Announcement, LegalDocument, Page } from "@/lib/types";

/**
 * GET /api/content/[resource] — konten publik:
 * pages | legal | announcements
 * (blog/knowledge-base/faq/testimonials/status punya endpoint sendiri.)
 */
export const GET = api({
  methods: ["GET"],
  handler: async ({ params }) => {
    const resource = params.resource;
    const driver = getDriver();
    if (resource === "pages") {
      const rows = await table<Page>("pages", driver).find({ status: "active" });
      return Response.json({ success: true, data: { pages: rows } });
    }
    if (resource === "pages-by-slug" || resource === "page") {
      return Response.json({ success: false, error: { code: "INVALID_RESOURCE", message: "Gunakan /api/content/pages." } }, { status: 400 });
    }
    if (resource === "legal") {
      const rows = await table<LegalDocument>("legal_documents", driver).all();
      return Response.json({ success: true, data: { documents: rows } });
    }
    if (resource === "announcements") {
      const now = new Date().toISOString();
      const rows = await table<Announcement>("announcements", driver).find(
        { status: "active" },
        { orderBy: [{ column: "created_at", dir: "desc" }] },
      );
      const active = rows.filter(
        (a) => (!a.starts_at || a.starts_at <= now) && (!a.ends_at || a.ends_at >= now),
      );
      return Response.json({ success: true, data: { announcements: active } });
    }
    return Response.json(
      { success: false, error: { code: "INVALID_RESOURCE", message: "Resource tidak dikenali." } },
      { status: 400 },
    );
  },
});
