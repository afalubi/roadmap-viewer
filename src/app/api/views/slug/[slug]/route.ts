import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { sql } from '@/lib/neon';
import { ensureViewsSchema } from '@/lib/viewsDb';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { fetchDatasourceItems } from '@/lib/roadmapDatasourceServer';

async function resolveSharedView(
  slug: string,
  password: string | null,
) {
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
    return { status: 404 as const };
  }

  if (viewRow.password_hash) {
    const provided = (password ?? '').trim();
    if (!provided) {
      return { status: 401 as const, error: 'Password required' };
    }
    const providedHash = createHash('sha256').update(provided).digest('hex');
    if (providedHash !== viewRow.password_hash) {
      return { status: 401 as const, error: 'Invalid password' };
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

  return {
    status: 200 as const,
    view: {
      id: viewRow.id,
      name: viewRow.name,
      roadmapId,
      payload: JSON.parse(viewRow.payload),
      sharedSlug: viewRow.slug,
      roadmapCsvText,
      items,
      role: 'viewer' as const,
    },
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const headerPassword = request.headers.get('x-view-link-password') ?? null;
  const result = await resolveSharedView(slug, headerPassword);
  if (result.status === 404) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (result.status === 401) {
    return NextResponse.json(
      { error: result.error, requiresPassword: true },
      { status: 401 },
    );
  }
  return NextResponse.json({ view: result.view });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    password?: string | null;
  };
  const provided = typeof body.password === 'string' ? body.password : null;
  const result = await resolveSharedView(slug, provided);
  if (result.status === 404) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (result.status === 401) {
    return NextResponse.json(
      { error: result.error, requiresPassword: true },
      { status: 401 },
    );
  }
  return NextResponse.json({ view: result.view });
}
