import { api, fromZodError } from "@/lib/api/helpers";
import { paginationQuerySchema } from "@/lib/validation";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { Profile, User } from "@/lib/types";

/** GET /api/admin/customers?q=&page= — daftar pelanggan (role customer & owner). */
export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "customers.view",
  handler: async ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const parsed = paginationQuerySchema.safeParse({
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("pageSize"),
    });
    if (!parsed.success) throw fromZodError(parsed.error);
    const { page, pageSize } = parsed.data;

    const driver = getDriver();
    const users = await table<User>("users", driver).all({ orderBy: [{ column: "created_at", dir: "desc" }] });
    const profiles = await table<Profile>("profiles", driver).all();
    const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
    const roles = await table("roles", driver).all();
    const roleMap = new Map(roles.map((r) => [r.id, r]));

    let rows = users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: profileMap.get(u.id)?.full_name ?? "",
      whatsapp: profileMap.get(u.id)?.whatsapp ?? "",
      roleSlug: String(roleMap.get(u.role_id)?.slug ?? "customer"),
      status: u.status,
      emailVerified: !!u.email_verified_at,
      createdAt: u.created_at,
    }));
    if (q) {
      rows = rows.filter((r) => r.email.toLowerCase().includes(q) || r.fullName.toLowerCase().includes(q) || r.whatsapp.includes(q));
    }
    const total = rows.length;
    return Response.json({
      success: true,
      data: { customers: rows.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize },
    });
  },
});
