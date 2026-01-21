import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/neon';
import { ensureViewsSchema } from '@/lib/viewsDb';
import { getViewRole, hasRoleAtLeast } from '@/lib/viewsAccess';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    payload?: unknown;
  };
  const name = body.name?.trim();
  const hasPayload = typeof body.payload !== 'undefined';

  if (!name && !hasPayload) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  await ensureViewsSchema();
  const existingRows = await sql`
    SELECT id
    FROM views
    WHERE id = ${id}
    LIMIT 1
  `;
  const existing = existingRows[0] as { id: string } | undefined;

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const role = await getViewRole(userId, id);
  if (!hasRoleAtLeast(role, 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const payloadJson = hasPayload ? JSON.stringify(body.payload) : null;

  await sql`
    UPDATE views
    SET name = COALESCE(${name ?? null}, name),
        payload = COALESCE(${payloadJson}, payload),
        updated_by = ${userId},
        updated_at = ${now}
    WHERE id = ${id}
  `;

  return NextResponse.json({ success: true, updatedAt: now });
}

export async function DELETE(
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
  const existing = existingRows[0] as { id: string } | undefined;

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const role = await getViewRole(userId, id);
  if (!hasRoleAtLeast(role, 'owner')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await sql`DELETE FROM views WHERE id = ${id}`;

  return NextResponse.json({ success: true });
}
