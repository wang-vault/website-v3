import { api, fromZodError } from "@/lib/api/helpers";
import { profileSchema } from "@/lib/validation";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { auditLog } from "@/lib/audit";
import { newId, nowIso } from "@/lib/utils";
import { ApiError } from "@/lib/security";
import type { Profile } from "@/lib/types";

export const GET = api({
  methods: ["GET"],
  auth: "required",
  handler: async ({ user }) => {
    const profile = await table<Profile>("profiles", getDriver()).findOne({ user_id: user.id });
    return Response.json({
      success: true,
      data: { profile: profile ?? null, user: { email: user.email, emailVerified: user.emailVerified, role: user.roleSlug } },
    });
  },
});

export const PATCH = api({
  methods: ["PATCH"],
  auth: "required",
  handler: async ({ request, user }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError("JSON tidak valid.", "INVALID_JSON", 400);
    }
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);
    const driver = getDriver();
    const profiles = table<Profile>("profiles", driver);
    const existing = await profiles.findOne({ user_id: user.id });
    const patch = {
      full_name: parsed.data.fullName,
      whatsapp: parsed.data.whatsapp ?? "",
      discord: parsed.data.discord ?? "",
      bio: parsed.data.bio ?? "",
      updated_at: nowIso(),
    };
    if (existing) {
      await profiles.update(existing.id as string, patch);
    } else {
      await profiles.insert({ id: newId(), user_id: user.id, ...patch, created_at: nowIso() });
    }
    await auditLog({ actorType: "user", actorId: user.id, actorEmail: user.email, action: "update", resource: "profile", resourceId: user.id });
    return Response.json({ success: true, data: { message: "Profil berhasil diperbarui." } });
  },
});
