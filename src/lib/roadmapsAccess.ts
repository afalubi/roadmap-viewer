import { sql } from '@/lib/neon';
import { getUserRoles } from '@/lib/usersDb';

export type RoadmapRole = 'owner' | 'editor' | 'viewer' | null;

const ROLE_ORDER: Record<Exclude<RoadmapRole, null>, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

export async function getRoadmapRole(
  userId: string,
  roadmapId: string,
): Promise<RoadmapRole> {
  const rows = await sql`
    SELECT role
    FROM roadmap_shares
    WHERE roadmap_id = ${roadmapId} AND user_id = ${userId}
    LIMIT 1
  `;
  const row = rows[0] as { role?: RoadmapRole } | undefined;
  return row?.role ?? null;
}

export async function getRoadmapRoleForUser(
  userId: string,
  roadmapId: string,
): Promise<RoadmapRole> {
  const roles = await getUserRoles(userId);
  if (roles.isSystemAdmin) {
    return 'owner';
  }
  return getRoadmapRole(userId, roadmapId);
}

export function hasRoadmapRoleAtLeast(
  role: RoadmapRole,
  required: 'viewer' | 'editor' | 'owner',
): boolean {
  if (!role) return false;
  return ROLE_ORDER[role] >= ROLE_ORDER[required];
}

export function canGrantRoadmapRole(
  grantor: RoadmapRole,
  target: 'viewer' | 'editor' | 'owner',
): boolean {
  if (!grantor) return false;
  return ROLE_ORDER[grantor] >= ROLE_ORDER[target];
}
