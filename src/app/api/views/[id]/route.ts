import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';

const generateSlug = () =>
  Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

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
    generateSlug?: boolean;
  };
  const name = body.name?.trim();
  const hasPayload = typeof body.payload !== 'undefined';
  const wantsSlug = Boolean(body.generateSlug);

  if (!name && !hasPayload && !wantsSlug) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const db = getDb();
  const existing = db
    .prepare(
      `SELECT id, scope, owner_user_id, shared_slug FROM views WHERE id = ? LIMIT 1`,
    )
    .get(id) as
    | {
        scope: 'personal' | 'shared';
        owner_user_id: string | null;
        shared_slug: string | null;
      }
    | undefined;

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (existing.scope === 'personal' && existing.owner_user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const payloadJson = hasPayload ? JSON.stringify(body.payload) : null;
  let sharedSlug: string | null = null;

  if (wantsSlug && existing.scope === 'shared' && !existing.owner_user_id) {
    if (existing.shared_slug) {
      sharedSlug = existing.shared_slug;
    } else {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = generateSlug();
        const collision = db
          .prepare(`SELECT id FROM views WHERE shared_slug = ? LIMIT 1`)
          .get(candidate);
        if (!collision) {
          sharedSlug = candidate;
          break;
        }
      }
      if (!sharedSlug) {
        return NextResponse.json(
          { error: 'Unable to generate share link' },
          { status: 500 },
        );
      }
    }
  }

  db.prepare(
    `UPDATE views
     SET name = COALESCE(?, name),
         payload = COALESCE(?, payload),
         shared_slug = COALESCE(?, shared_slug),
         updated_by = ?,
         updated_at = ?
     WHERE id = ?`,
  ).run(name ?? null, payloadJson, sharedSlug, userId, now, id);

  return NextResponse.json({ success: true, updatedAt: now, sharedSlug });
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
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT id, scope, owner_user_id FROM views WHERE id = ? LIMIT 1`,
    )
    .get(id) as { scope: 'personal' | 'shared'; owner_user_id: string | null } | undefined;

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (existing.scope === 'personal' && existing.owner_user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  db.prepare(`DELETE FROM views WHERE id = ?`).run(id);

  return NextResponse.json({ success: true });
}
