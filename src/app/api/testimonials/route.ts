import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { Testimonial } from "@/lib/types";

export const GET = api({
  methods: ["GET"],
  handler: async () => {
    const rows = await table<Testimonial>("testimonials", getDriver()).find(
      { status: "published" },
      { orderBy: [{ column: "created_at", dir: "desc" }] },
    );
    return Response.json({ success: true, data: { testimonials: rows } });
  },
});
