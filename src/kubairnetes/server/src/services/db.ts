import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { getCacheDir } from '../utils/project.js';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(getCacheDir(), 'kubairnetes.db');
    const dir = path.dirname(dbPath);
    mkdirSync(dir, { recursive: true });
    try { writeFileSync(path.join(dir, '.gitignore'), '*\n', { flag: 'wx' }); } catch {}

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS decks (
      id              TEXT PRIMARY KEY,
      readme_path     TEXT NOT NULL,
      title           TEXT NOT NULL DEFAULT 'Untitled',
      content_hash    TEXT,
      status          TEXT NOT NULL DEFAULT 'curriculum_draft'
                      CHECK(status IN ('curriculum_draft','curriculum_approved','generating','ready','error')),
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS curriculum_items (
      id              TEXT PRIMARY KEY,
      deck_id         TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      order_num       INTEGER NOT NULL DEFAULT 0,
      title           TEXT NOT NULL,
      subtitle        TEXT,
      covered_section TEXT,
      visual_types    TEXT NOT NULL DEFAULT '[]',
      command_count   INTEGER NOT NULL DEFAULT 0,
      user_notes      TEXT,
      approved        INTEGER NOT NULL DEFAULT 1 CHECK(approved IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS slides (
      id              TEXT PRIMARY KEY,
      deck_id         TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      curriculum_id   TEXT REFERENCES curriculum_items(id) ON DELETE SET NULL,
      order_num       INTEGER NOT NULL DEFAULT 0,
      cache_path      TEXT,
      status          TEXT NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending','generating','ready','error')),
      generated_at    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_curriculum_deck ON curriculum_items(deck_id, order_num);
    CREATE INDEX IF NOT EXISTS idx_slides_deck ON slides(deck_id, order_num);
  `);
}
