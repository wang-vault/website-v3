import { api, fromZodError } from "@/lib/api/helpers";
import { settingsPatchSchema } from "@/lib/validation/admin";
import { getSettings, updateSettings } from "@/lib/settings";
import { auditLog } from "@/lib/audit";

export const GET = api({
  methods: ["GET"],
  auth: "admin",
  permission: "settings.manage",
  handler: async () => {
    const settings = await getSettings();
    return Response.json({ success: true, data: { settings } });
  },
});

/** PATCH — pengaturan platform: branding, sosial, kontak, maintenance, reminder. */
export const PATCH = api({
  methods: ["PATCH"],
  auth: "admin",
  permission: "settings.manage",
  handler: async ({ request, user, ip }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = settingsPatchSchema.safeParse(body);
    if (!parsed.success) throw fromZodError(parsed.error);
    const patch: Record<string, unknown> = {};
    const allowed = [
      "siteName",
      "siteTagline",
      "siteDescription",
      "seoTitle",
      "seoDescription",
      "whatsappNumber",
      "discordUrl",
      "emailPublic",
      "contactNote",
      "maintenanceEnabled",
      "maintenanceTitle",
      "maintenanceMessage",
      "maintenanceUntil",
      "maintenanceAllowedPaths",
      "remindersEnabled",
      "reminderIntervals",
    ];
    for (const key of allowed) {
      if (parsed.data[key as keyof typeof parsed.data] !== undefined) {
        patch[key] = parsed.data[key as keyof typeof parsed.data];
      }
    }
    const updated = await updateSettings(patch, { id: user.id, email: user.email });
    await auditLog({
      actorType: "user",
      actorId: user.id,
      actorEmail: user.email,
      action: "settings.update",
      resource: "settings",
      ip,
      metadata: { fields: Object.keys(patch) },
    });
    return Response.json({ success: true, data: { settings: updated } });
  },
});
