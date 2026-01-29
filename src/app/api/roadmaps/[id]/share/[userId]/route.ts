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
  console.log('[roadmap-share-update] resolveUserId input', trimmed);
  const client = await clerkClient();
  if (trimmed.includes('@')) {
    try {
      console.log('[roadmap-share-update] lookup by emailAddress', trimmed.toLowerCase());
      const result = await client.users.getUserList({
        emailAddress: [trimmed.toLowerCase()],
        limit: 1,
      });
      const users = Array.isArray(result) ? result : result.data;
      console.log('[roadmap-share-update] emailAddress result', {
        count: users?.length ?? 0,
        ids: users?.map((user) => user.id),
        emails: users?.map((user) =>
          user.emailAddresses?.map((entry: { emailAddress?: string }) => entry.emailAddress),
        ),
      });
      const user = users?.[0];
      if (user?.id) return user.id;
    } catch (error) {
      console.log('[roadmap-share-update] emailAddress lookup error', error);
      return null;
    }
    try {
      console.log('[roadmap-share-update] lookup by query', trimmed);
      const result = await client.users.getUserList({
        query: trimmed,
        limit: 10,
      });
      const users = Array.isArray(result) ? result : result.data;
      console.log('[roadmap-share-update] query result', {
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
      console.log('[roadmap-share-update] query match', match?.id ?? null);
      return match?.id ?? null;
    } catch (error) {
      console.log('[roadmap-share-update] query lookup error', error);
      return null;
    }
  }
  console.log('[roadmap-share-update] treating input as user id', trimmed);
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

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> },
) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, userId: targetParam } = await context.params;
  const body = (await request.json()) as { role?: RoadmapRole };
  const requestedRole = body.role;
  const targetUserId = await resolveUserId(targetParam);
  const targetEmail = targetParam.includes('@') ? targetParam : null;
  console.log('[roadmap-share-update] resolved target', {
    input: targetParam,
    resolved: targetUserId,
  });
  const client = await clerkClient();
  const resolvedEmail =
    targetEmail ?? (targetUserId ? await resolveUserEmail(targetUserId, client) : null);

  if (!targetUserId) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (!requestedRole || !VALID_ROLES.includes(requestedRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

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
  if (!target) {
    return NextResponse.json({ error: 'Share not found' }, { status: 404 });
  }
  if (target.role && !canModifyShareEntry(grantorRole, target.role, targetUserId === authUser.id)) {
    return NextResponse.json({ error: 'Cannot modify peer access' }, { status: 403 });
  }

  const now = new Date().toISOString();
  await sql`
    UPDATE roadmap_shares
    SET role = ${requestedRole},
        user_email = COALESCE(${resolvedEmail}, roadmap_shares.user_email),
        updated_at = ${now},
        updated_by = ${authUser.id}
    WHERE roadmap_id = ${id} AND user_id = ${targetUserId}
  `;

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> },
) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, userId: targetParam } = await context.params;
  const targetUserId = await resolveUserId(targetParam);
  console.log('[roadmap-share-update] resolved target', {
    input: targetParam,
    resolved: targetUserId,
  });
  if (!targetUserId) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (targetUserId === authUser.id) {
    return NextResponse.json(
      { error: 'Cannot revoke your own access' },
      { status: 400 },
    );
  }

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

  const grantorRole = await getRoadmapRoleForUser(authUser.id, id);
  if (!hasRoadmapRoleAtLeast(grantorRole, 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const targetRows = await sql`
    SELECT role
    FROM roadmap_shares
    WHERE roadmap_id = ${id} AND user_id = ${targetUserId}
    LIMIT 1
  `;
  const target = targetRows[0] as { role: RoadmapRole } | undefined;
  if (!target) {
    return NextResponse.json({ error: 'Share not found' }, { status: 404 });
  }
  if (!target.role) {
    return NextResponse.json({ error: 'Invalid share role' }, { status: 500 });
  }

  if (!canModifyShareEntry(grantorRole, target.role, targetUserId === authUser.id)) {
    return NextResponse.json({ error: 'Cannot modify peer access' }, { status: 403 });
  }
  if (!canGrantRoadmapRole(grantorRole, target.role)) {
    return NextResponse.json({ error: 'Cannot revoke higher role' }, { status: 403 });
  }

  await sql`
    DELETE FROM roadmap_shares
    WHERE roadmap_id = ${id} AND user_id = ${targetUserId}
  `;

  return NextResponse.json({ success: true });
}
