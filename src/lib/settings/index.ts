import { getDriver, usingJsonFallback } from "@/lib/db";
import { table } from "@/lib/db/types";
import { newId, nowIso } from "@/lib/utils";

export interface AppSettings {
  siteName: string;
  siteTagline: string;
  siteDescription: string;
  seoTitle: string;
  seoDescription: string;
  whatsappNumber: string;
  discordUrl: string;
  emailPublic: string;
  contactNote: string;
  maintenanceEnabled: boolean;
  maintenanceTitle: string;
  maintenanceMessage: string;
  maintenanceUntil: string;
  maintenanceAllowedPaths: string[];
  remindersEnabled: boolean;
  reminderIntervals: number[];
  [key: string]: string | boolean | number | number[] | string[];
}

const DEFAULTS: AppSettings = {
  siteName: "WangStore",
  siteTagline: "Build Your Own Server.",
  siteDescription: "WangStore adalah platform pemesanan dan pengelolaan layanan hosting.",
  seoTitle: "WangStore — Build Your Own Server.",
  seoDescription: "Platform pemesanan layanan hosting: Minecraft hosting, VPS, dan dedicated server.",
  whatsappNumber: "",
  discordUrl: "",
  emailPublic: "",
  contactNote: "Tim WangStore siap membantu Anda sebelum dan sesudah pemesanan.",
  maintenanceEnabled: false,
  maintenanceTitle: "Pemeliharaan Terjadwal",
  maintenanceMessage: "WangStore sedang dalam pemeliharaan. Kami akan segera kembali.",
  maintenanceUntil: "",
  maintenanceAllowedPaths: ["/api/health", "/login", "/api/auth/login", "/api/csrf"],
  remindersEnabled: true,
  reminderIntervals: [7, 3, 1],
};

const MEMO_MS = 5000;
let memo: { at: number; settings: AppSettings } | null = null;

/** Baca seluruh pengaturan (cache pendek untuk mengurangi query). */
export async function getSettings(): Promise<AppSettings> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.settings;
  const rows = await table("settings", getDriver()).all();
  const out: AppSettings = { ...DEFAULTS };
  for (const row of rows) {
    const key = String(row.key);
    const raw = String(row.value);
    try {
      const parsed = JSON.parse(raw) as unknown;
      (out as Record<string, unknown>)[key] = parsed as never;
    } catch {
      (out as Record<string, unknown>)[key] = raw as never;
    }
  }
  memo = { at: Date.now(), settings: out };
  return out;
}

/** Tulis satu atau beberapa pengaturan (dengan audit log). */
export async function updateSettings(
  patch: Record<string, unknown>,
  actor?: { id: string; email: string } | null,
): Promise<AppSettings> {
  memo = null;
  const driver = getDriver();
  const settingsTable = table("settings", driver);
  for (const [key, value] of Object.entries(patch)) {
    const existing = await settingsTable.findOne({ key });
    const row = {
      id: existing?.id ?? newId(),
      key,
      value: JSON.stringify(value),
      updated_by: actor?.id ?? null,
      created_at: existing?.created_at ?? nowIso(),
      updated_at: nowIso(),
    };
    if (existing) {
      await driver.execute(
        'UPDATE settings SET value = $1, updated_by = $2, updated_at = $3 WHERE id = $4',
        [row.value, row.updated_by, row.updated_at, row.id],
      );
    } else {
      await settingsTable.insert(row);
    }
  }
  return getSettings();
}

export function isJsonFallback(): boolean {
  return usingJsonFallback();
}

export function maintenanceAllowed(pathname: string, settings: AppSettings): boolean {
  const p = pathname.split("?")[0];
  return settings.maintenanceAllowedPaths.some((allowed) => {
    if (allowed === p) return true;
    if (allowed.endsWith("*")) return p.startsWith(allowed.slice(0, -1));
    return false;
  });
}
