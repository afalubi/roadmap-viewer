import { sql } from '@/lib/neon';

export async function ensureRoadmapsSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS roadmaps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      csv_text TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_roadmaps_name ON roadmaps(name);`;

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
    CREATE TABLE IF NOT EXISTS roadmap_links (
      slug TEXT PRIMARY KEY,
      roadmap_id TEXT NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('viewer')),
      password_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_roadmap_links_roadmap ON roadmap_links(roadmap_id);`;
}
