import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/neon';
import { getAuthUser } from '@/lib/usersAccess';
import { ensureUsersSchema, updateUserRoles } from '@/lib/usersDb';
import { getRequestMeta, recordAuditEvent } from '@/lib/auditLog';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!authUser.roles.isSystemAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    isSystemAdmin?: boolean;
    canCreateRoadmaps?: boolean;
  };

  if (typeof body.isSystemAdmin === 'boolean') {
    if (id === authUser.id && body.isSystemAdmin === false) {
      return NextResponse.json(
        { error: 'You cannot remove your own admin access.' },
        { status: 403 },
      );
    }

    if (body.isSystemAdmin === false) {
      await ensureUsersSchema();
      const targetRows = await sql`
        SELECT is_system_admin
        FROM user_roles
        WHERE user_id = ${id}
        LIMIT 1
      `;
      const targetIsAdmin = Boolean(
        (targetRows[0] as { is_system_admin?: boolean } | undefined)
          ?.is_system_admin,
      );
      if (targetIsAdmin) {
        const rows = await sql`
          SELECT COUNT(*)::int AS count
          FROM user_roles
          WHERE is_system_admin = true
        `;
        const totalAdmins =
          (rows[0] as { count?: number } | undefined)?.count ?? 0;
        if (totalAdmins <= 1) {
          return NextResponse.json(
            { error: 'At least one admin must remain.' },
            { status: 400 },
          );
        }
      }
    }
  }

  await updateUserRoles(id, {
    isSystemAdmin:
      typeof body.isSystemAdmin === 'boolean' ? body.isSystemAdmin : undefined,
    canCreateRoadmaps:
      typeof body.canCreateRoadmaps === 'boolean'
        ? body.canCreateRoadmaps
        : undefined,
  });

  await recordAuditEvent({
    actorUserId: authUser.id,
    action: 'admin.update_roles',
    targetType: 'user',
    targetId: id,
    metadata: {
      isSystemAdmin: body.isSystemAdmin,
      canCreateRoadmaps: body.canCreateRoadmaps,
    },
    ...getRequestMeta(request.headers),
  });

  return NextResponse.json({ success: true });
}
