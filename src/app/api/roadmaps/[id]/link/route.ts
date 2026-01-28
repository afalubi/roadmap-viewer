import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/neon';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getRoadmapRole, hasRoadmapRoleAtLeast } from '@/lib/roadmapsAccess';

type LinkRole = 'viewer';

const generateSlug = () =>
  Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

async function generateUniqueSlug() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = generateSlug();
    const rows = await sql`
      SELECT slug
      FROM roadmap_links
      WHERE slug = ${candidate}
      LIMIT 1
    `;
    if (rows.length === 0) {
      return candidate;
    }
  }
  return null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  await request.json().catch(() => null);
  const requestedRole: LinkRole = 'viewer';

  await ensureRoadmapsSchema();
  const existingRoadmapRows = await sql`
    SELECT id
    FROM roadmaps
    WHERE id = ${id}
    LIMIT 1
  `;
  if (existingRoadmapRows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const grantorRole = await getRoadmapRole(userId, id);
  if (!hasRoadmapRoleAtLeast(grantorRole, 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const existingRows = await sql`
    SELECT slug
    FROM roadmap_links
    WHERE roadmap_id = ${id}
    LIMIT 1
  `;
  const existingSlug = existingRows[0]?.slug as string | undefined;

  if (existingSlug) {
    await sql`
      UPDATE roadmap_links
      SET role = ${requestedRole},
          password_hash = NULL,
          updated_at = ${now},
          updated_by = ${userId}
      WHERE roadmap_id = ${id}
    `;
    return NextResponse.json({ slug: existingSlug });
  }

  const slug = await generateUniqueSlug();
  if (!slug) {
    return NextResponse.json(
      { error: 'Unable to generate share link' },
      { status: 500 },
    );
  }

  await sql`
    INSERT INTO roadmap_links
      (slug, roadmap_id, role, password_hash, created_at, updated_at, created_by, updated_by)
    VALUES
      (${slug}, ${id}, ${requestedRole}, NULL, ${now}, ${now}, ${userId}, ${userId})
  `;

  return NextResponse.json({ slug });
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
  const existingRoadmapRows = await sql`
    SELECT id
    FROM roadmaps
    WHERE id = ${id}
    LIMIT 1
  `;
  if (existingRoadmapRows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const role = await getRoadmapRole(userId, id);
  if (!hasRoadmapRoleAtLeast(role, 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await sql`DELETE FROM roadmap_links WHERE roadmap_id = ${id}`;
  return NextResponse.json({ success: true });
}
