import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/neon';
import { ensureViewsSchema } from '@/lib/viewsDb';
import { canGrantRole, getViewRole, hasRoleAtLeast, type ViewRole } from '@/lib/viewsAccess';

const VALID_ROLES: ViewRole[] = ['viewer', 'editor', 'owner'];

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  await ensureViewsSchema();

  const existingRows = await sql`
    SELECT id
    FROM views
    WHERE id = ${id}
    LIMIT 1
  `;
  if (existingRows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const role = await getViewRole(userId, id);
  if (!hasRoleAtLeast(role, 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await sql`
    SELECT user_id, role, created_at, updated_at
    FROM view_shares
    WHERE view_id = ${id}
    ORDER BY
      CASE role
        WHEN 'owner' THEN 3
        WHEN 'editor' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 0
      END DESC,
      updated_at DESC
  `;

  return NextResponse.json({
    shares: rows.map((row: any) => ({
      userId: row.user_id,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as { userId?: string; role?: ViewRole };
  const targetUserId = body.userId?.trim();
  const requestedRole = body.role;

  if (!targetUserId || !requestedRole || !VALID_ROLES.includes(requestedRole)) {
    return NextResponse.json({ error: 'Invalid share request' }, { status: 400 });
  }

  await ensureViewsSchema();
  const existingRows = await sql`
    SELECT id
    FROM views
    WHERE id = ${id}
    LIMIT 1
  `;
  if (existingRows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const grantorRole = await getViewRole(userId, id);
  if (!hasRoleAtLeast(grantorRole, 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!canGrantRole(grantorRole, requestedRole)) {
    return NextResponse.json({ error: 'Cannot grant higher role' }, { status: 403 });
  }
  if (targetUserId === userId && requestedRole !== 'owner') {
    return NextResponse.json(
      { error: 'Owner cannot demote themselves' },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  await sql`
    INSERT INTO view_shares
      (view_id, user_id, role, created_at, updated_at, created_by, updated_by)
    VALUES
      (${id}, ${targetUserId}, ${requestedRole}, ${now}, ${now}, ${userId}, ${userId})
    ON CONFLICT (view_id, user_id)
    DO UPDATE SET
      role = ${requestedRole},
      updated_at = ${now},
      updated_by = ${userId}
  `;

  return NextResponse.json({ success: true });
}
