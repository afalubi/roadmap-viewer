import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createHash } from 'crypto';
import { sql } from '@/lib/neon';
import { ensureViewsSchema } from '@/lib/viewsDb';
import { canGrantRole, getViewRole, hasRoleAtLeast, type ViewRole } from '@/lib/viewsAccess';

type LinkRole = 'viewer';

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
  const body = (await request.json()) as {
    password?: string | null;
    rotate?: boolean;
  };
  const rotate = Boolean(body.rotate);
  const requestedRole: LinkRole = 'viewer';

  await ensureViewsSchema();
  const existingViewRows = await sql`
    SELECT id
    FROM views
    WHERE id = ${id}
    LIMIT 1
  `;
  if (existingViewRows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const grantorRole = await getViewRole(userId, id);
  if (!hasRoleAtLeast(grantorRole, 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!canGrantRole(grantorRole, requestedRole)) {
    return NextResponse.json({ error: 'Cannot grant higher role' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const passwordHash = body.password ? hashPassword(body.password) : null;

  const existingRows = await sql`
    SELECT slug
    FROM view_links
    WHERE view_id = ${id}
    LIMIT 1
  `;
  const existingSlug = existingRows[0]?.slug as string | undefined;

  if (existingSlug && !rotate) {
    await sql`
      UPDATE view_links
      SET role = ${requestedRole},
          password_hash = ${passwordHash},
          updated_at = ${now},
          updated_by = ${userId}
      WHERE view_id = ${id}
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

  await sql`DELETE FROM view_links WHERE view_id = ${id}`;
  await sql`
    INSERT INTO view_links
      (slug, view_id, role, password_hash, created_at, updated_at, created_by, updated_by)
    VALUES
      (${slug}, ${id}, ${requestedRole}, ${passwordHash}, ${now}, ${now}, ${userId}, ${userId})
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
  const existingViewRows = await sql`
    SELECT id
    FROM views
    WHERE id = ${id}
    LIMIT 1
  `;
  if (existingViewRows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const role = await getViewRole(userId, id);
  if (!hasRoleAtLeast(role, 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await sql`DELETE FROM view_links WHERE view_id = ${id}`;
  return NextResponse.json({ success: true });
}
