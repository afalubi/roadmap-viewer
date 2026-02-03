import { sql } from '@/lib/neon';
import type { IdentityProvider, UserRoles } from '@/types/users';

export async function ensureUsersSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      idp TEXT NOT NULL CHECK (idp IN ('clerk','azure_ad')),
      external_id TEXT NOT NULL,
      email TEXT,
      display_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS idp TEXT;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS external_id TEXT;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_idp_external ON users(idp, external_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`;

  await sql`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      is_system_admin BOOLEAN NOT NULL DEFAULT false,
      can_create_roadmaps BOOLEAN NOT NULL DEFAULT false,
      can_view_capacity BOOLEAN NOT NULL DEFAULT false,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `;
  await sql`ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN;`;
  await sql`ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS can_create_roadmaps BOOLEAN;`;
  await sql`ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS can_view_capacity BOOLEAN;`;
}

export async function upsertUser(params: {
  id: string;
  idp: IdentityProvider;
  externalId: string;
  email: string | null;
  displayName: string | null;
}) {
  await ensureUsersSchema();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO users (id, idp, external_id, email, display_name, created_at, updated_at)
    VALUES (${params.id}, ${params.idp}, ${params.externalId}, ${params.email}, ${params.displayName}, ${now}, ${now})
    ON CONFLICT (id)
    DO UPDATE SET
      idp = ${params.idp},
      external_id = ${params.externalId},
      email = COALESCE(${params.email}, users.email),
      display_name = COALESCE(${params.displayName}, users.display_name),
      updated_at = ${now}
  `;
}

export async function ensureUserRoles(userId: string) {
  await ensureUsersSchema();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO user_roles (user_id, is_system_admin, can_create_roadmaps, can_view_capacity, created_at, updated_at)
    VALUES (${userId}, false, false, false, ${now}, ${now})
    ON CONFLICT (user_id) DO NOTHING
  `;
}

export async function getUserRoles(userId: string): Promise<UserRoles> {
  await ensureUsersSchema();
  const rows = await sql`
    SELECT is_system_admin, can_create_roadmaps, can_view_capacity
    FROM user_roles
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  const row = rows[0] as
    | {
        is_system_admin?: boolean | null;
        can_create_roadmaps?: boolean | null;
        can_view_capacity?: boolean | null;
      }
    | undefined;
  return {
    isSystemAdmin: Boolean(row?.is_system_admin),
    canCreateRoadmaps: Boolean(row?.can_create_roadmaps),
    canViewCapacity: Boolean(row?.can_view_capacity),
  };
}

export async function updateUserRoles(
  userId: string,
  roles: Partial<UserRoles>,
) {
  await ensureUsersSchema();
  const now = new Date().toISOString();
  await ensureUserRoles(userId);
  await sql`
    UPDATE user_roles
    SET is_system_admin = COALESCE(${roles.isSystemAdmin ?? null}, is_system_admin),
        can_create_roadmaps = COALESCE(${roles.canCreateRoadmaps ?? null}, can_create_roadmaps),
        can_view_capacity = COALESCE(${roles.canViewCapacity ?? null}, can_view_capacity),
        updated_at = ${now}
    WHERE user_id = ${userId}
  `;
}
