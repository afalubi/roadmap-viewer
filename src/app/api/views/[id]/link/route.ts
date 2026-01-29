import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createHash } from 'crypto';
import { sql } from '@/lib/neon';
import { ensureViewsSchema } from '@/lib/viewsDb';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getRoadmapRole, hasRoadmapRoleAtLeast } from '@/lib/roadmapsAccess';

const generateSlug = () =>
  Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

const hashPassword = (value: string) =>
  createHash('sha256').update(value).digest('hex');

async function generateUniqueSlug() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = generateSlug();
    const rows = await sql`
      SELECT slug
      FROM view_links
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
  const body = (await request.json().catch(() => ({}))) as {
    password?: string | null;
    rotate?: boolean;
  };
  const hasPasswordField = Object.prototype.hasOwnProperty.call(body, 'password');
  const rawPassword =
    typeof body.password === 'string' ? body.password.trim() : '';
  const passwordHash = rawPassword ? hashPassword(rawPassword) : null;
  const rotate = Boolean(body.rotate);
  await ensureViewsSchema();
  const viewRows = await sql`
    SELECT id, roadmap_id
    FROM views
    WHERE id = ${id}
    LIMIT 1
  `;
  const view = viewRows[0] as { id: string; roadmap_id?: string | null } | undefined;
  if (!view) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await ensureRoadmapsSchema();
  const roadmapId = view.roadmap_id ?? '';
  const role = roadmapId ? await getRoadmapRole(userId, roadmapId) : null;
  if (!hasRoadmapRoleAtLeast(role, 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const existingRows = await sql`
    SELECT slug
    FROM view_links
    WHERE view_id = ${id}
    LIMIT 1
  `;
  const existingSlug = (existingRows[0] as { slug?: string } | undefined)?.slug;

  if (existingSlug && !rotate) {
    if (hasPasswordField) {
      await sql`
        UPDATE view_links
        SET password_hash = ${passwordHash},
            updated_at = ${now},
            updated_by = ${userId}
        WHERE view_id = ${id}
      `;
    }
    return NextResponse.json({ slug: existingSlug });
  }

  if (existingSlug) {
    await sql`
      DELETE FROM view_links
      WHERE view_id = ${id}
    `;
  }

  const slug = await generateUniqueSlug();
  if (!slug) {
    return NextResponse.json({ error: 'Unable to generate link' }, { status: 500 });
  }

  await sql`
    INSERT INTO view_links (slug, view_id, role, password_hash, created_at, updated_at, created_by, updated_by)
    VALUES (${slug}, ${id}, 'viewer', ${passwordHash}, ${now}, ${now}, ${userId}, ${userId})
    ON CONFLICT (slug) DO NOTHING
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
  await ensureViewsSchema();
  const viewRows = await sql`
    SELECT id, roadmap_id
    FROM views
    WHERE id = ${id}
    LIMIT 1
  `;
  const view = viewRows[0] as { id: string; roadmap_id?: string | null } | undefined;
  if (!view) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await ensureRoadmapsSchema();
  const roadmapId = view.roadmap_id ?? '';
  const role = roadmapId ? await getRoadmapRole(userId, roadmapId) : null;
  if (!hasRoadmapRoleAtLeast(role, 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await sql`
    DELETE FROM view_links
    WHERE view_id = ${id}
  `;

  return NextResponse.json({ success: true });
}
