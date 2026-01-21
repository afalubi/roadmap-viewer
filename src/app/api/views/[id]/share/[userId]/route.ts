import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/neon';
import { ensureViewsSchema } from '@/lib/viewsDb';
import { canGrantRole, getViewRole, hasRoleAtLeast, type ViewRole } from '@/lib/viewsAccess';

const VALID_ROLES: ViewRole[] = ['viewer', 'editor', 'owner'];

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, userId: targetUserId } = await context.params;
  const body = (await request.json()) as { role?: ViewRole };
  const requestedRole = body.role;

  if (!requestedRole || !VALID_ROLES.includes(requestedRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
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

  const targetRows = await sql`
    SELECT role
    FROM view_shares
    WHERE view_id = ${id} AND user_id = ${targetUserId}
    LIMIT 1
  `;
  const target = targetRows[0] as { role: ViewRole } | undefined;
  if (!target) {
    return NextResponse.json({ error: 'Share not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  await sql`
    UPDATE view_shares
    SET role = ${requestedRole},
        updated_at = ${now},
        updated_by = ${userId}
    WHERE view_id = ${id} AND user_id = ${targetUserId}
  `;

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, userId: targetUserId } = await context.params;
  if (targetUserId === userId) {
    return NextResponse.json(
      { error: 'Cannot revoke your own access' },
      { status: 400 },
    );
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

  const targetRows = await sql`
    SELECT role
    FROM view_shares
    WHERE view_id = ${id} AND user_id = ${targetUserId}
    LIMIT 1
  `;
  const target = targetRows[0] as { role: ViewRole } | undefined;
  if (!target) {
    return NextResponse.json({ error: 'Share not found' }, { status: 404 });
  }
  if (!target.role) {
    return NextResponse.json({ error: 'Invalid share role' }, { status: 500 });
  }

  if (!canGrantRole(grantorRole, target.role)) {
    return NextResponse.json({ error: 'Cannot revoke higher role' }, { status: 403 });
  }

  await sql`
    DELETE FROM view_shares
    WHERE view_id = ${id} AND user_id = ${targetUserId}
  `;

  return NextResponse.json({ success: true });
}
