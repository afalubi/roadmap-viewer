import { sql } from '@/lib/neon';

export async function ensureRoadmapsSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS roadmaps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_title TEXT,
      csv_text TEXT NOT NULL,
      theme_json TEXT,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `;
  await sql`ALTER TABLE roadmaps ADD COLUMN IF NOT EXISTS display_title TEXT;`;
  await sql`ALTER TABLE roadmaps ADD COLUMN IF NOT EXISTS theme_json TEXT;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_roadmaps_name ON roadmaps(name);`;

  await sql`
    CREATE TABLE IF NOT EXISTS roadmap_datasources (
      roadmap_id TEXT PRIMARY KEY REFERENCES roadmaps(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('csv','azure-devops')),
      config_json TEXT NOT NULL,
      secret_encrypted TEXT,
      last_snapshot_json TEXT,
      last_snapshot_at TEXT,
      last_sync_at TEXT,
      last_sync_duration_ms INTEGER,
      last_sync_item_count INTEGER,
      last_sync_error TEXT
    );
  `;
  await sql`ALTER TABLE roadmap_datasources ADD COLUMN IF NOT EXISTS type TEXT`;
  await sql`ALTER TABLE roadmap_datasources ADD COLUMN IF NOT EXISTS config_json TEXT`;
  await sql`ALTER TABLE roadmap_datasources ADD COLUMN IF NOT EXISTS secret_encrypted TEXT`;
  await sql`ALTER TABLE roadmap_datasources ADD COLUMN IF NOT EXISTS last_snapshot_json TEXT`;
  await sql`ALTER TABLE roadmap_datasources ADD COLUMN IF NOT EXISTS last_snapshot_at TEXT`;
  await sql`ALTER TABLE roadmap_datasources ADD COLUMN IF NOT EXISTS last_sync_at TEXT`;
  await sql`ALTER TABLE roadmap_datasources ADD COLUMN IF NOT EXISTS last_sync_duration_ms INTEGER`;
  await sql`ALTER TABLE roadmap_datasources ADD COLUMN IF NOT EXISTS last_sync_item_count INTEGER`;
  await sql`ALTER TABLE roadmap_datasources ADD COLUMN IF NOT EXISTS last_sync_error TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS roadmap_shares (
      roadmap_id TEXT NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('viewer','editor','owner')),
      user_email TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      PRIMARY KEY (roadmap_id, user_id)
    );
  `;
  await sql`ALTER TABLE roadmap_shares ADD COLUMN IF NOT EXISTS user_email TEXT;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_roadmap_shares_user ON roadmap_shares(user_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_roadmap_shares_roadmap ON roadmap_shares(roadmap_id);`;

  await sql`
    DROP TABLE IF EXISTS roadmap_links;
  `;
}
