import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createHash } from 'crypto';
import { sql } from '@/lib/neon';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getRoadmapRole, type RoadmapRole } from '@/lib/roadmapsAccess';

const hashPassword = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const roleRank: Record<Exclude<RoadmapRole, null>, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { userId } = await auth();
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
      r.created_at,
      r.updated_at,
      rl.slug,
      rl.password_hash
    FROM roadmap_links rl
    JOIN roadmaps r ON r.id = rl.roadmap_id
    WHERE rl.slug = ${slug}
    LIMIT 1
  `;
  const row = (rows[0] as
    | {
        id: string;
        name: string;
        csv_text: string;
        created_at: string;
        updated_at: string;
        slug: string;
        password_hash: string | null;
      }
    | undefined);

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const providedPassword =
    request.headers.get('x-roadmap-link-password') ??
    new URL(request.url).searchParams.get('password');
  if (row.password_hash) {
    if (!providedPassword) {
      return NextResponse.json(
        { error: 'Password required', requiresPassword: true },
        { status: 401 },
      );
    }
    if (hashPassword(providedPassword) !== row.password_hash) {
      return NextResponse.json(
        { error: 'Invalid password', requiresPassword: true },
        { status: 401 },
      );
    }
  }

  const shareRole = userId ? await getRoadmapRole(userId, row.id) : null;
  const effectiveRole = shareRole
    ? roleRank[shareRole] >= roleRank.viewer ? shareRole : 'viewer'
    : 'viewer';

  return NextResponse.json({
    roadmap: {
      id: row.id,
      name: row.name,
      csvText: row.csv_text,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sharedSlug: row.slug,
      role: effectiveRole,
    },
  });
}
