import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/neon';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureRoadmapsSchema();
  const rows = await sql`
    SELECT
      r.id,
      r.name,
      r.created_at,
      r.updated_at,
      rs.role
    FROM roadmaps r
    JOIN roadmap_shares rs
      ON rs.roadmap_id = r.id
    WHERE rs.user_id = ${userId}
    ORDER BY r.updated_at DESC
  `;

  const roadmaps = rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    role: row.role,
  }));

  return NextResponse.json({ roadmaps });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    csvText?: string;
  };
  const name = (body.name ?? '').trim();
  const csvText = body.csvText ?? '';

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  await ensureRoadmapsSchema();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await sql`
    INSERT INTO roadmaps
      (id, name, csv_text, created_by, updated_by, created_at, updated_at)
    VALUES
      (${id}, ${name}, ${csvText}, ${userId}, ${userId}, ${now}, ${now})
  `;
  await sql`
    INSERT INTO roadmap_shares
      (roadmap_id, user_id, role, created_at, updated_at, created_by, updated_by)
    VALUES
      (${id}, ${userId}, 'owner', ${now}, ${now}, ${userId}, ${userId})
  `;
  await sql`
    INSERT INTO roadmap_datasources (roadmap_id, type, config_json)
    VALUES (${id}, 'csv', '{}')
    ON CONFLICT (roadmap_id) DO NOTHING
  `;

  return NextResponse.json({
    roadmap: {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      role: 'owner',
    },
  });
}
