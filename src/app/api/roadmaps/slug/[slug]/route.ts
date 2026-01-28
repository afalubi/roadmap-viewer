import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/neon';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getRoadmapRole, type RoadmapRole } from '@/lib/roadmapsAccess';
import { fetchDatasourceItems } from '@/lib/roadmapDatasourceServer';
import type { RoadmapThemeConfig } from '@/types/theme';

const roleRank: Record<Exclude<RoadmapRole, null>, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

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
  request: NextRequest,
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

  await ensureRoadmapsSchema();
  const rows = await sql`
    SELECT
      r.id,
      r.name,
      r.csv_text,
      r.theme_json,
      r.created_at,
      r.updated_at,
      ds.type AS datasource_type,
      rl.slug
    FROM roadmap_links rl
    JOIN roadmaps r ON r.id = rl.roadmap_id
    LEFT JOIN roadmap_datasources ds ON ds.roadmap_id = r.id
    WHERE rl.slug = ${slug}
    LIMIT 1
  `;
  const row = (rows[0] as
    | {
        id: string;
        name: string;
        csv_text: string;
        theme_json?: string | null;
        created_at: string;
        updated_at: string;
        datasource_type?: string | null;
        slug: string;
      }
    | undefined);

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const shareRole = await getRoadmapRole(userId, row.id);
  if (!shareRole || roleRank[shareRole] < roleRank.viewer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const effectiveRole = shareRole;

  const datasourceType = row.datasource_type ?? 'csv';
  let items: unknown = null;
  try {
    const result = await fetchDatasourceItems(row.id, false);
    items = result.items;
  } catch {
    items = null;
  }

  return NextResponse.json({
    roadmap: {
      id: row.id,
      name: row.name,
      csvText: row.csv_text,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sharedSlug: row.slug,
      role: effectiveRole,
      datasourceType,
      items,
      themeConfig: parseThemeConfig(row.theme_json),
    },
  });
}
