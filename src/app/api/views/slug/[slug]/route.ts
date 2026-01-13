import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await context.params;
  if (!slug) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, name, scope, payload, shared_slug, created_at, updated_at
       FROM views
       WHERE scope = 'shared' AND shared_slug = ?
       LIMIT 1`,
    )
    .get(slug) as
    | {
        id: string;
        name: string;
        scope: string;
        payload: string;
        shared_slug: string | null;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    view: {
      id: row.id,
      name: row.name,
      scope: row.scope,
      payload: JSON.parse(row.payload),
      sharedSlug: row.shared_slug,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  });
}
