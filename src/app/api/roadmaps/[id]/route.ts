import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/neon';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getRoadmapRoleForUser, hasRoadmapRoleAtLeast } from '@/lib/roadmapsAccess';
import { getAuthUser } from '@/lib/usersAccess';
import type { RoadmapThemeConfig } from '@/types/theme';

const parseThemeConfig = (
  value?: string | null,
): RoadmapThemeConfig | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as RoadmapThemeConfig;
  } catch {
    return null;
  }
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  await ensureRoadmapsSchema();

  const role = await getRoadmapRoleForUser(authUser.id, id);
  if (!hasRoadmapRoleAtLeast(role, 'viewer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await sql`
    SELECT r.id, r.name, r.csv_text, r.theme_json, r.created_at, r.updated_at, ds.type AS datasource_type
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
        theme_json?: string | null;
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
      themeConfig: parseThemeConfig(row.theme_json),
    },
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthUser();
  if (!authUser) {
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
  const role = await getRoadmapRoleForUser(authUser.id, id);
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
        updated_by = ${authUser.id},
        updated_at = ${now}
    WHERE id = ${id}
  `;

  return NextResponse.json({ success: true, updatedAt: now });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  await ensureRoadmapsSchema();

  const role = await getRoadmapRoleForUser(authUser.id, id);
  if (!hasRoadmapRoleAtLeast(role, 'owner')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await sql`DELETE FROM roadmaps WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
