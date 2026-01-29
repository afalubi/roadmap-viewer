import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon';
import { ensureAuditSchema } from '@/lib/auditLog';
import { getAuthUser } from '@/lib/usersAccess';

const MAX_LIMIT = 200;

export async function GET(request: Request) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!authUser.roles.isSystemAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensureAuditSchema();

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get('limit') ?? '50');
  const limit = Number.isFinite(limitParam)
    ? Math.min(MAX_LIMIT, Math.max(1, limitParam))
    : 50;
  const actor = searchParams.get('actor')?.trim() ?? '';
  const action = searchParams.get('action')?.trim() ?? '';
  const targetType = searchParams.get('targetType')?.trim() ?? '';
  const q = searchParams.get('q')?.trim().toLowerCase() ?? '';

  const actorFilter = actor ? `%${actor}%` : null;
  const actionFilter = action ? `%${action}%` : null;
  const targetFilter = targetType ? `%${targetType}%` : null;
  const qFilter = q ? `%${q}%` : null;

  const rows = await sql`
    SELECT id, actor_user_id, action, target_type, target_id, metadata_json, ip_address, user_agent, created_at
    FROM audit_log
    WHERE (
        ${actorFilter}::text IS NULL
        OR actor_user_id ILIKE ${actorFilter}
      )
      AND (
        ${actionFilter}::text IS NULL
        OR action ILIKE ${actionFilter}
      )
      AND (
        ${targetFilter}::text IS NULL
        OR target_type ILIKE ${targetFilter}
      )
      AND (
        ${qFilter}::text IS NULL
        OR (
          COALESCE(target_id, '') ILIKE ${qFilter}
          OR COALESCE(metadata_json, '') ILIKE ${qFilter}
        )
      )
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  const audit = rows.map((row: any) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id ?? null,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    ipAddress: row.ip_address ?? null,
    userAgent: row.user_agent ?? null,
    createdAt: row.created_at,
  }));

  return NextResponse.json({ audit });
}
