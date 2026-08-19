import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { newId, nowIso } from "@/lib/utils";

export interface AuditEntry {
  actorType?: "user" | "system";
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Catat audit log. Jangan pernah menyimpan password/secret di sini. */
export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    const driver = getDriver();
    await table("audit_logs", driver).insert({
      id: newId(),
      actor_type: entry.actorType ?? "user",
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      resource: entry.resource,
      resource_id: entry.resourceId ?? null,
      ip: entry.ip ?? null,
      user_agent: entry.userAgent ?? null,
      metadata: entry.metadata ?? null,
      created_at: nowIso(),
    });
  } catch {
    // Audit log tidak boleh menggagalkan operasi utama.
  }
}

export async function listAuditLogs(opts: {
  limit?: number;
  offset?: number;
  action?: string;
  resource?: string;
  actorEmail?: string;
}) {
  const driver = getDriver();
  const audit = table("audit_logs", driver);
  const where: Record<string, unknown> = {};
  if (opts.action) where.action = opts.action;
  if (opts.resource) where.resource = opts.resource;
  if (opts.actorEmail) where.actor_email = { op: "ilike", value: `%${opts.actorEmail}%` } as never;
  const [rows, total] = await Promise.all([
    audit.find(where, { orderBy: [{ column: "created_at", dir: "desc" }], limit: opts.limit ?? 50, offset: opts.offset ?? 0 }),
    audit.count(where),
  ]);
  return { rows, total };
}
