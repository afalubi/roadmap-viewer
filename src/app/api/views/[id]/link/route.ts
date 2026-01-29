import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { sql } from '@/lib/neon';
import { ensureViewsSchema } from '@/lib/viewsDb';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getRoadmapRoleForUser, hasRoadmapRoleAtLeast } from '@/lib/roadmapsAccess';
import { getAuthUser } from '@/lib/usersAccess';
import { getRequestMeta, recordAuditEvent } from '@/lib/auditLog';

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
  const authUser = await getAuthUser();
  if (!authUser) {
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
  const role = roadmapId ? await getRoadmapRoleForUser(authUser.id, roadmapId) : null;
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
        updated_by = ${authUser.id}
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
    VALUES (${slug}, ${id}, 'viewer', ${passwordHash}, ${now}, ${now}, ${authUser.id}, ${authUser.id})
    ON CONFLICT (slug) DO NOTHING
  `;

  await recordAuditEvent({
    actorUserId: authUser.id,
    action: existingSlug && rotate ? 'view_link.rotate' : 'view_link.create',
    targetType: 'view_link',
    targetId: slug,
    metadata: { viewId: id },
    ...getRequestMeta(request.headers),
  });

  return NextResponse.json({ slug });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthUser();
  if (!authUser) {
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
  const role = roadmapId ? await getRoadmapRoleForUser(authUser.id, roadmapId) : null;
  if (!hasRoadmapRoleAtLeast(role, 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await sql`
    DELETE FROM view_links
    WHERE view_id = ${id}
  `;

  await recordAuditEvent({
    actorUserId: authUser.id,
    action: 'view_link.remove',
    targetType: 'view_link',
    targetId: id,
    metadata: { viewId: id },
    ...getRequestMeta(request.headers),
  });

  return NextResponse.json({ success: true });
}
