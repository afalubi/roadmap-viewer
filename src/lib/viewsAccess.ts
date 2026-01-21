import { sql } from '@/lib/neon';

export type ViewRole = 'owner' | 'editor' | 'viewer' | null;

const ROLE_ORDER: Record<Exclude<ViewRole, null>, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

export async function getViewRole(
  userId: string,
  viewId: string,
): Promise<ViewRole> {
  const rows = await sql`
    SELECT role
    FROM view_shares
    WHERE view_id = ${viewId} AND user_id = ${userId}
    LIMIT 1
  `;
  const row = rows[0] as { role?: ViewRole } | undefined;
  return row?.role ?? null;
}

export function hasRoleAtLeast(role: ViewRole, required: 'viewer' | 'editor' | 'owner'): boolean {
  if (!role) return false;
  return ROLE_ORDER[role] >= ROLE_ORDER[required];
}

export function canGrantRole(
  grantor: ViewRole,
  target: 'viewer' | 'editor' | 'owner',
): boolean {
  if (!grantor) return false;
  return ROLE_ORDER[grantor] >= ROLE_ORDER[target];
}
