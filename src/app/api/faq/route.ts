import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { FaqItem } from "@/lib/types";

export const GET = api({
  methods: ["GET"],
  handler: async () => {
    const rows = await table<FaqItem>("faq_items", getDriver()).find(
      { status: "active" },
      { orderBy: [{ column: "sort", dir: "asc" }] },
    );
    return Response.json({ success: true, data: { faqs: rows } });
  },
});
