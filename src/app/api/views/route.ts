import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon';
import { ensureViewsSchema } from '@/lib/viewsDb';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getRoadmapRoleForUser, hasRoadmapRoleAtLeast } from '@/lib/roadmapsAccess';
import { getAuthUser } from '@/lib/usersAccess';

export async function GET(request: Request) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const roadmapId = searchParams.get('roadmapId');
  if (!roadmapId) {
    return NextResponse.json({ error: 'roadmapId is required' }, { status: 400 });
  }

  await ensureRoadmapsSchema();
  const roadmapRole = await getRoadmapRoleForUser(authUser.id, roadmapId);
  if (!hasRoadmapRoleAtLeast(roadmapRole, 'viewer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensureViewsSchema();
  const rows = await sql`
    SELECT
      v.id,
      v.name,
      v.roadmap_id,
      v.payload,
      v.created_at,
      v.updated_at,
      vl.shared_slug
    FROM views v
    LEFT JOIN (
      SELECT view_id, MIN(slug) AS shared_slug
      FROM view_links
      GROUP BY view_id
    ) vl
      ON vl.view_id = v.id
    WHERE v.roadmap_id = ${roadmapId}
    ORDER BY v.updated_at DESC
  `;

  const views = rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    roadmapId: row.roadmap_id ?? '',
    payload: JSON.parse(row.payload),
    sharedSlug: row.shared_slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    role: roadmapRole,
  }));

  return NextResponse.json({ views });
}

export async function POST(request: Request) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    payload?: unknown;
    roadmapId?: string;
  };
  const name = (body.name ?? '').trim();
  const roadmapId = body.roadmapId?.trim() ?? '';

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!body.payload) {
    return NextResponse.json({ error: 'Payload is required' }, { status: 400 });
  }
  if (!roadmapId) {
    return NextResponse.json({ error: 'Roadmap is required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await ensureRoadmapsSchema();
  const roadmapRole = await getRoadmapRoleForUser(authUser.id, roadmapId);
  if (!hasRoadmapRoleAtLeast(roadmapRole, 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureViewsSchema();

  await sql`
    INSERT INTO views
      (id, name, scope, roadmap_id, owner_user_id, created_by, updated_by, payload, shared_slug, created_at, updated_at)
    VALUES
      (${id}, ${name}, 'personal', ${roadmapId}, ${authUser.id}, ${authUser.id}, ${authUser.id},
       ${JSON.stringify(body.payload)}, NULL, ${now}, ${now})
  `;
  return NextResponse.json({
    view: {
      id,
      name,
      roadmapId,
      payload: body.payload,
      createdAt: now,
      updatedAt: now,
      role: roadmapRole,
    },
  });
}
