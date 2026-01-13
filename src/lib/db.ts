import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = path.join(process.cwd(), 'data', 'roadmap.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
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
  `);

  try {
    db.exec(`ALTER TABLE views ADD COLUMN shared_slug TEXT;`);
  } catch {
    // Column already exists.
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_views_scope ON views(scope);
    CREATE INDEX IF NOT EXISTS idx_views_owner ON views(owner_user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_views_shared_slug ON views(shared_slug);
  `);

  return db;
}
