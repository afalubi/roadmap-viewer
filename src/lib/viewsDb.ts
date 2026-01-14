import { sql } from '@/lib/neon';

export async function ensureViewsSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS views (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      scope TEXT NOT NULL CHECK (scope IN ('personal','shared')),
      owner_user_id TEXT,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      payload TEXT NOT NULL,
      shared_slug TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_views_scope ON views(scope);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_views_owner ON views(owner_user_id);`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_views_shared_slug ON views(shared_slug);`;
}
