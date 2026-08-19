import { api } from "@/lib/api/helpers";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import type { Profile, User } from "@/lib/types";

/** GET /api/admin/users — daftar user (untuk kelola role/status). */
export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "users.manage",
  handler: async () => {
    const driver = getDriver();
    const [users, profiles, roles] = await Promise.all([
      table<User>("users", driver).all({ orderBy: [{ column: "created_at", dir: "desc" }] }),
      table<Profile>("profiles", driver).all(),
      table("roles", driver).all(),
    ]);
    const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
    const roleMap = new Map(roles.map((r) => [r.id, r]));
    return Response.json({
      success: true,
      data: {
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          fullName: profileMap.get(u.id)?.full_name ?? "",
          roleSlug: String(roleMap.get(u.role_id)?.slug ?? "customer"),
          status: u.status,
          emailVerified: !!u.email_verified_at,
          createdAt: u.created_at,
        })),
      },
    });
  },
});
