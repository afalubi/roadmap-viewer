import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { sql } from '@/lib/neon';
import { ensureViewsSchema } from '@/lib/viewsDb';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { fetchDatasourceItems } from '@/lib/roadmapDatasourceServer';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  await ensureViewsSchema();
  const rows = await sql`
    SELECT v.id, v.name, v.payload, v.roadmap_id, vl.slug, vl.password_hash
    FROM view_links vl
    JOIN views v ON v.id = vl.view_id
    WHERE vl.slug = ${slug}
    LIMIT 1
  `;
  const viewRow = rows[0] as
    | {
        id: string;
        name: string;
        payload: string;
        roadmap_id: string | null;
        slug: string;
        password_hash?: string | null;
      }
    | undefined;
  if (!viewRow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (viewRow.password_hash) {
    const provided = (request.headers.get('x-view-link-password') ?? '').trim();
    if (!provided) {
      return NextResponse.json(
        { error: 'Password required', requiresPassword: true },
        { status: 401 },
      );
    }
    const providedHash = createHash('sha256').update(provided).digest('hex');
    if (providedHash !== viewRow.password_hash) {
      return NextResponse.json(
        { error: 'Invalid password', requiresPassword: true },
        { status: 401 },
      );
    }
  }

  await ensureRoadmapsSchema();
  const roadmapId = viewRow.roadmap_id ?? '';
  let roadmapCsvText = '';
  try {
    const roadmapRows = await sql`
      SELECT csv_text
      FROM roadmaps
      WHERE id = ${roadmapId}
      LIMIT 1
    `;
    roadmapCsvText =
      (roadmapRows[0] as { csv_text?: string } | undefined)?.csv_text ?? '';
  } catch {
    roadmapCsvText = '';
  }

  let items: unknown[] = [];
  try {
    const result = await fetchDatasourceItems(roadmapId, false);
    items = result.items ?? [];
  } catch {
    items = [];
  }

  return NextResponse.json({
    view: {
      id: viewRow.id,
      name: viewRow.name,
      roadmapId,
      payload: JSON.parse(viewRow.payload),
      sharedSlug: viewRow.slug,
      roadmapCsvText,
      items,
      role: 'viewer',
    },
  });
}
