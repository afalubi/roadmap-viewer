import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon';
import { ensureUsersSchema } from '@/lib/usersDb';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import { getAuthUser } from '@/lib/usersAccess';

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!authUser.roles.isSystemAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensureRoadmapsSchema();
  await ensureUsersSchema();
  const rows = await sql`
    SELECT
      u.id,
      u.idp,
      u.external_id,
      u.email,
      u.display_name,
      u.created_at,
      u.updated_at,
      COALESCE(ur.is_system_admin, false) AS is_system_admin,
      COALESCE(ur.can_create_roadmaps, false) AS can_create_roadmaps,
      COALESCE(ur.can_view_capacity, false) AS can_view_capacity,
      COALESCE(rs.owned_count, 0) AS owned_count,
      COALESCE(rs.shared_count, 0) AS shared_count
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN (
      SELECT
        user_id,
        SUM(CASE WHEN role = 'owner' THEN 1 ELSE 0 END) AS owned_count,
        COUNT(*) AS shared_count
      FROM roadmap_shares
      GROUP BY user_id
    ) rs ON rs.user_id = u.id
    ORDER BY u.email NULLS LAST, u.display_name NULLS LAST
  `;

  const users = rows.map((row: any) => ({
    id: row.id,
    idp: row.idp,
    externalId: row.external_id,
    email: row.email ?? null,
    displayName: row.display_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isSystemAdmin: Boolean(row.is_system_admin),
    canCreateRoadmaps: Boolean(row.can_create_roadmaps),
    canViewCapacity: Boolean(row.can_view_capacity),
    ownedCount: Number(row.owned_count ?? 0),
    sharedCount: Number(row.shared_count ?? 0),
  }));

  const stats = users.reduce(
    (acc, user) => {
      acc.total += 1;
      if (user.idp === 'azure_ad') {
        acc.byIdp.azure_ad += 1;
        if (!user.sharedCount) {
          acc.unassignedAdUsers += 1;
        }
      } else {
        acc.byIdp.clerk += 1;
      }
      return acc;
    },
    {
      total: 0,
      byIdp: { clerk: 0, azure_ad: 0 },
      unassignedAdUsers: 0,
    },
  );

  return NextResponse.json({ users, stats });
}
