import { sql } from '@/lib/neon';

export type AuditEvent = {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function ensureAuditSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      metadata_json TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_type, target_id);`;
}

export async function recordAuditEvent(event: AuditEvent) {
  await ensureAuditSchema();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO audit_log
      (id, actor_user_id, action, target_type, target_id, metadata_json, ip_address, user_agent, created_at)
    VALUES
      (
        ${id},
        ${event.actorUserId},
        ${event.action},
        ${event.targetType},
        ${event.targetId ?? null},
        ${event.metadata ? JSON.stringify(event.metadata) : null},
        ${event.ipAddress ?? null},
        ${event.userAgent ?? null},
        ${now}
      )
  `;
}

export const getRequestMeta = (headers: Headers) => ({
  ipAddress:
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip'),
  userAgent: headers.get('user-agent'),
});
