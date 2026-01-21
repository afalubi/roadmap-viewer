import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/neon';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getRoadmapRole, hasRoadmapRoleAtLeast } from '@/lib/roadmapsAccess';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  await ensureRoadmapsSchema();

  const role = await getRoadmapRole(userId, id);
  if (!hasRoadmapRoleAtLeast(role, 'viewer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await sql`
    SELECT id, name, csv_text, created_at, updated_at
    FROM roadmaps
    WHERE id = ${id}
    LIMIT 1
  `;
  const row = rows[0] as
    | {
        id: string;
        name: string;
        csv_text: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    roadmap: {
      id: row.id,
      name: row.name,
      csvText: row.csv_text,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      role,
    },
  });
}

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
    csvText?: string;
  };
  const name = body.name?.trim();
  const hasCsv = typeof body.csvText !== 'undefined';

  if (!name && !hasCsv) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  await ensureRoadmapsSchema();
  const role = await getRoadmapRole(userId, id);
  if (!hasRoadmapRoleAtLeast(role, 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date().toISOString();
  await sql`
    UPDATE roadmaps
    SET name = COALESCE(${name ?? null}, name),
        csv_text = COALESCE(${body.csvText ?? null}, csv_text),
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
  await ensureRoadmapsSchema();

  const role = await getRoadmapRole(userId, id);
  if (!hasRoadmapRoleAtLeast(role, 'owner')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await sql`DELETE FROM roadmaps WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
