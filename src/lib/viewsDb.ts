import { sql } from '@/lib/neon';

export async function ensureViewsSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS views (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      scope TEXT NOT NULL CHECK (scope IN ('personal','shared')),
      roadmap_id TEXT,
      owner_user_id TEXT,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      payload TEXT NOT NULL,
      shared_slug TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `;
  await sql`ALTER TABLE views ADD COLUMN IF NOT EXISTS roadmap_id TEXT;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_views_scope ON views(scope);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_views_owner ON views(owner_user_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_views_roadmap ON views(roadmap_id);`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_views_shared_slug ON views(shared_slug);`;

  await sql`
    DROP TABLE IF EXISTS view_shares;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS view_links (
      slug TEXT PRIMARY KEY,
      view_id TEXT NOT NULL REFERENCES views(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('viewer','editor')),
      password_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_view_links_view ON view_links(view_id);`;

  await sql`
    INSERT INTO view_links
      (slug, view_id, role, password_hash, created_at, updated_at, created_by, updated_by)
    SELECT
      v.shared_slug,
      v.id,
      'viewer',
      NULL,
      v.created_at,
      v.updated_at,
      v.created_by,
      v.updated_by
    FROM views v
    WHERE v.shared_slug IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM view_links vl
        WHERE vl.slug = v.shared_slug
      );
  `;
}
