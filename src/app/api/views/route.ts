import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/neon';
import { ensureViewsSchema } from '@/lib/viewsDb';

const VALID_SCOPES = new Set(['personal', 'shared']);

const generateSlug = () =>
  Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') ?? 'personal';
  if (!VALID_SCOPES.has(scope)) {
    return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
  }

  await ensureViewsSchema();
  const rows =
    scope === 'personal'
      ? await sql`
          SELECT id, name, scope, payload, shared_slug, created_at, updated_at
          FROM views
          WHERE scope = 'personal' AND owner_user_id = ${userId}
          ORDER BY updated_at DESC
        `
      : await sql`
          SELECT id, name, scope, payload, shared_slug, created_at, updated_at
          FROM views
          WHERE scope = 'shared'
          ORDER BY updated_at DESC
        `;

  const views = rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    scope: row.scope,
    payload: JSON.parse(row.payload),
    sharedSlug: row.shared_slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return NextResponse.json({ views });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    scope?: 'personal' | 'shared';
    payload?: unknown;
  };
  const name = (body.name ?? '').trim();
  const scope = body.scope ?? 'personal';

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!VALID_SCOPES.has(scope)) {
    return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
  }
  if (!body.payload) {
    return NextResponse.json({ error: 'Payload is required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await ensureViewsSchema();
  let sharedSlug: string | null = null;

  if (scope === 'shared') {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateSlug();
      const existing = await sql`
        SELECT id FROM views WHERE shared_slug = ${candidate} LIMIT 1
      `;
      if (existing.length === 0) {
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

  await sql`
    INSERT INTO views
      (id, name, scope, owner_user_id, created_by, updated_by, payload, shared_slug, created_at, updated_at)
    VALUES
      (${id}, ${name}, ${scope}, ${scope === 'personal' ? userId : null}, ${userId}, ${userId},
       ${JSON.stringify(body.payload)}, ${sharedSlug}, ${now}, ${now})
  `;

  return NextResponse.json({
    view: {
      id,
      name,
      scope,
      payload: body.payload,
      sharedSlug,
      createdAt: now,
      updatedAt: now,
    },
  });
}
