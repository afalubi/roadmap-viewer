import { NextResponse, type NextRequest } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { sql } from '@/lib/neon';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import {
  canGrantRoadmapRole,
  getRoadmapRoleForUser,
  hasRoadmapRoleAtLeast,
  type RoadmapRole,
} from '@/lib/roadmapsAccess';
import { getAuthUser } from '@/lib/usersAccess';

const VALID_ROLES: RoadmapRole[] = ['editor', 'owner'];

const canModifyShareEntry = (
  grantorRole: RoadmapRole,
  targetRole: RoadmapRole,
  isSelf: boolean,
) => {
  if (!grantorRole || !targetRole) return false;
  if (isSelf) return false;
  if (grantorRole === 'owner') return true;
  return targetRole === 'viewer';
};

async function resolveUserId(value: string): Promise<string | null> {
  const trimmed = value.trim();
  if (!trimmed) return null;
  console.log('[roadmap-share] resolveUserId input', trimmed);
  const client = await clerkClient();
  if (trimmed.includes('@')) {
    try {
      console.log('[roadmap-share] lookup by emailAddress', trimmed.toLowerCase());
      const result = await client.users.getUserList({
        emailAddress: [trimmed.toLowerCase()],
        limit: 1,
      });
      const users = Array.isArray(result) ? result : result.data;
      console.log('[roadmap-share] emailAddress result', {
        count: users?.length ?? 0,
        ids: users?.map((user) => user.id),
        emails: users?.map((user) =>
          user.emailAddresses?.map((entry: { emailAddress?: string }) => entry.emailAddress),
        ),
      });
      const user = users?.[0];
      if (user?.id) return user.id;
    } catch (error) {
      console.log('[roadmap-share] emailAddress lookup error', error);
      return null;
    }
    try {
      console.log('[roadmap-share] lookup by query', trimmed);
      const result = await client.users.getUserList({
        query: trimmed,
        limit: 10,
      });
      const users = Array.isArray(result) ? result : result.data;
      console.log('[roadmap-share] query result', {
        count: users?.length ?? 0,
        ids: users?.map((user) => user.id),
        emails: users?.map((user) =>
          user.emailAddresses?.map((entry: { emailAddress?: string }) => entry.emailAddress),
        ),
      });
      const match = users?.find((candidate) =>
        candidate.emailAddresses?.some(
          (entry: { emailAddress?: string }) =>
            entry.emailAddress?.toLowerCase() === trimmed.toLowerCase(),
        ),
      );
      console.log('[roadmap-share] query match', match?.id ?? null);
      return match?.id ?? null;
    } catch (error) {
      console.log('[roadmap-share] query lookup error', error);
      return null;
    }
  }
  console.log('[roadmap-share] treating input as user id', trimmed);
  return trimmed;
}

async function resolveUserEmail(
  userId: string,
  client: Awaited<ReturnType<typeof clerkClient>>,
): Promise<string | null> {
  try {
    const user = await client.users.getUser(userId);
    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses?.[0]?.emailAddress;
    return email ?? null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  await ensureRoadmapsSchema();

  const existingRows = await sql`
    SELECT id
    FROM roadmaps
    WHERE id = ${id}
    LIMIT 1
  `;
  if (existingRows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const role = await getRoadmapRoleForUser(authUser.id, id);
  if (!hasRoadmapRoleAtLeast(role, 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await sql`
    SELECT user_id, role, user_email, created_at, updated_at
    FROM roadmap_shares
    WHERE roadmap_id = ${id}
    ORDER BY
      CASE role
        WHEN 'owner' THEN 3
        WHEN 'editor' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 0
      END DESC,
      updated_at DESC
  `;

  const client = await clerkClient();
  const shares = await Promise.all(
    rows.map(async (row: any) => {
      const email =
        row.user_email ??
        (await resolveUserEmail(row.user_id as string, client));
      return {
        userId: row.user_id,
        userEmail: email ?? 'Email unavailable',
        role: row.role,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }),
  );

  return NextResponse.json({ shares });
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
  const body = (await request.json()) as { userId?: string; role?: RoadmapRole };
  const targetInput = body.userId?.trim() ?? '';
  const requestedRole = body.role;
  const targetEmail = targetInput.includes('@') ? targetInput : null;

  const targetUserId = targetInput ? await resolveUserId(targetInput) : null;
  console.log('[roadmap-share] resolved target', {
    input: targetInput,
    resolved: targetUserId,
  });

  if (!targetUserId) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (!requestedRole || !VALID_ROLES.includes(requestedRole)) {
    return NextResponse.json({ error: 'Invalid share request' }, { status: 400 });
  }

  await ensureRoadmapsSchema();
  const client = await clerkClient();
  const existingRows = await sql`
    SELECT id
    FROM roadmaps
    WHERE id = ${id}
    LIMIT 1
  `;
  if (existingRows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const grantorRole = await getRoadmapRoleForUser(authUser.id, id);
  if (!hasRoadmapRoleAtLeast(grantorRole, 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!canGrantRoadmapRole(grantorRole, requestedRole)) {
    return NextResponse.json({ error: 'Cannot grant higher role' }, { status: 403 });
  }
  if (targetUserId === authUser.id) {
    return NextResponse.json(
      { error: 'Cannot change your own access' },
      { status: 400 },
    );
  }

  const targetRows = await sql`
    SELECT role
    FROM roadmap_shares
    WHERE roadmap_id = ${id} AND user_id = ${targetUserId}
    LIMIT 1
  `;
  const target = targetRows[0] as { role: RoadmapRole } | undefined;
  if (target?.role && !canModifyShareEntry(grantorRole, target.role, targetUserId === authUser.id)) {
    return NextResponse.json({ error: 'Cannot modify peer access' }, { status: 403 });
  }
  if (target?.role && !canGrantRoadmapRole(grantorRole, target.role)) {
    return NextResponse.json({ error: 'Cannot update higher role' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const resolvedEmail =
    targetEmail ?? (targetUserId ? await resolveUserEmail(targetUserId, client) : null);
  await sql`
    INSERT INTO roadmap_shares
      (roadmap_id, user_id, role, user_email, created_at, updated_at, created_by, updated_by)
    VALUES
      (${id}, ${targetUserId}, ${requestedRole}, ${resolvedEmail}, ${now}, ${now}, ${authUser.id}, ${authUser.id})
    ON CONFLICT (roadmap_id, user_id)
    DO UPDATE SET
      role = ${requestedRole},
      user_email = COALESCE(${resolvedEmail}, roadmap_shares.user_email),
      updated_at = ${now},
      updated_by = ${authUser.id}
  `;

  return NextResponse.json({ success: true });
}
