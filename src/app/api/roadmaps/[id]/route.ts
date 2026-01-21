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
    SELECT r.id, r.name, r.csv_text, r.created_at, r.updated_at, ds.type AS datasource_type
    FROM roadmaps r
    LEFT JOIN roadmap_datasources ds ON ds.roadmap_id = r.id
    WHERE r.id = ${id}
    LIMIT 1
  `;
  const row = rows[0] as
    | {
        id: string;
        name: string;
        csv_text: string;
        created_at: string;
        updated_at: string;
        datasource_type?: string | null;
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
      datasourceType: row.datasource_type ?? 'csv',
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

  if (hasCsv) {
    const datasourceRows = await sql`
      SELECT type
      FROM roadmap_datasources
      WHERE roadmap_id = ${id}
      LIMIT 1
    `;
    const datasourceType = (datasourceRows[0] as { type?: string } | undefined)
      ?.type;
    if (datasourceType && datasourceType !== 'csv') {
      return NextResponse.json(
        { error: 'CSV updates are disabled for this datasource' },
        { status: 400 },
      );
    }
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
