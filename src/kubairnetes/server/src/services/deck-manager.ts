import { getDb } from './db.js';
import { randomUUID } from 'crypto';
import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { getCacheDir } from '../utils/project.js';
import type { AISlide } from './slide-generator.js';

// ---- Types (what the application sees — parsed, typesafe) ----

export type DeckStatus = 'curriculum_draft' | 'curriculum_approved' | 'generating' | 'ready' | 'error';
export type SlideStatus = 'pending' | 'generating' | 'ready' | 'error';
export type VisualType = 'hpa' | 'probes' | 'resources' | 'qos' | 'vpa' | 'rollout' | 'mermaid' | 'architecture' | 'custom' | 'none';

export interface Deck {
  id: string;
  readme_path: string;
  title: string;
  content_hash: string | null;
  status: DeckStatus;
  created_at: string;
  updated_at: string;
}

export interface CurriculumItem {
  id: string;
  deck_id: string;
  order_num: number;
  title: string;
  subtitle: string | null;
  covered_section: string | null;
  visual_types: VisualType[];
  command_count: number;
  user_notes: string | null;
  approved: boolean;
}

export interface SlideRecord {
  id: string;
  deck_id: string;
  curriculum_id: string | null;
  order_num: number;
  cache_path: string | null;
  status: SlideStatus;
  generated_at: string | null;
}

// ---- DB row types (raw from SQLite — JSON strings, integers for booleans) ----

interface CurriculumItemRow {
  id: string;
  deck_id: string;
  order_num: number;
  title: string;
  subtitle: string | null;
  covered_section: string | null;
  visual_types: string; // JSON array string
  command_count: number;
  user_notes: string | null;
  approved: number; // 0 or 1
}

function parseCurriculumRow(row: CurriculumItemRow): CurriculumItem {
  return {
    ...row,
    visual_types: safeParseJsonArray(row.visual_types),
    approved: row.approved === 1,
  };
}

function safeParseJsonArray(json: string): VisualType[] {
  try { return JSON.parse(json); } catch { return []; }
}

function slideCachePath(slideId: string): string {
  return path.join(getCacheDir(), 'slides', `${slideId}.json`);
}

// ---- Deck CRUD ----

export function createDeck(readmePath: string, title = 'Untitled'): Deck {
  const db = getDb();
  const id = randomUUID();
  db.prepare(`INSERT INTO decks (id, readme_path, title) VALUES (?, ?, ?)`)
    .run(id, readmePath, title);
  return getDeck(id)!;
}

export function getDeck(id: string): Deck | null {
  const db = getDb();
  return db.prepare('SELECT * FROM decks WHERE id = ?').get(id) as Deck | null;
}

export function listDecks(): Deck[] {
  const db = getDb();
  return db.prepare('SELECT * FROM decks ORDER BY updated_at DESC').all() as Deck[];
}

export function updateDeck(id: string, updates: Partial<Pick<Deck, 'title' | 'status' | 'content_hash'>>): void {
  const db = getDb();
  const sets: string[] = ["updated_at = datetime('now')"];
  const values: any[] = [];

  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined) {
      sets.push(`${key} = ?`);
      values.push(val);
    }
  }
  values.push(id);
  db.prepare(`UPDATE decks SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteDeck(id: string): void {
  const db = getDb();
  // Get all slide cache paths to clean up files
  const slides = db.prepare('SELECT cache_path FROM slides WHERE deck_id = ?').all(id) as { cache_path: string | null }[];
  db.prepare('DELETE FROM decks WHERE id = ?').run(id);

  // Cleanup cached slide files (async, best-effort)
  for (const s of slides) {
    if (s.cache_path) unlink(s.cache_path).catch(() => {});
  }
}

// ---- Curriculum CRUD ----

export function setCurriculumItems(deckId: string, items: Omit<CurriculumItem, 'id' | 'deck_id'>[]): CurriculumItem[] {
  const db = getDb();
  db.prepare('DELETE FROM curriculum_items WHERE deck_id = ?').run(deckId);

  const insert = db.prepare(`
    INSERT INTO curriculum_items (id, deck_id, order_num, title, subtitle, covered_section, visual_types, command_count, user_notes, approved)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const inserted: CurriculumItem[] = [];
  for (const item of items) {
    const id = randomUUID();
    const visualTypesJson = JSON.stringify(item.visual_types);
    insert.run(
      id, deckId, item.order_num, item.title, item.subtitle ?? null,
      item.covered_section ?? null, visualTypesJson,
      item.command_count, item.user_notes ?? null, item.approved ? 1 : 0,
    );
    inserted.push({ ...item, id, deck_id: deckId });
  }

  return inserted;
}

export function getCurriculumItems(deckId: string): CurriculumItem[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM curriculum_items WHERE deck_id = ? ORDER BY order_num').all(deckId) as CurriculumItemRow[];
  return rows.map(parseCurriculumRow);
}

export function updateCurriculumItem(itemId: string, updates: Partial<Pick<CurriculumItem, 'title' | 'subtitle' | 'visual_types' | 'user_notes' | 'approved' | 'order_num'>>): void {
  const db = getDb();
  const sets: string[] = [];
  const values: any[] = [];

  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined) {
      sets.push(`${key} = ?`);
      if (key === 'visual_types') values.push(JSON.stringify(val));
      else if (key === 'approved') values.push(val ? 1 : 0);
      else values.push(val);
    }
  }
  if (sets.length === 0) return;
  values.push(itemId);
  db.prepare(`UPDATE curriculum_items SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

// ---- Slide CRUD + File Cache ----

export function createSlideRecords(deckId: string, curriculumItems: CurriculumItem[]): SlideRecord[] {
  const db = getDb();
  // Clear existing slides for this deck
  const oldSlides = db.prepare('SELECT cache_path FROM slides WHERE deck_id = ?').all(deckId) as { cache_path: string | null }[];
  db.prepare('DELETE FROM slides WHERE deck_id = ?').run(deckId);

  // Cleanup old files
  for (const s of oldSlides) {
    if (s.cache_path) unlink(s.cache_path).catch(() => {});
  }

  const insert = db.prepare(`
    INSERT INTO slides (id, deck_id, curriculum_id, order_num, cache_path, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `);

  const records: SlideRecord[] = [];
  for (const item of curriculumItems.filter(i => i.approved)) {
    const id = randomUUID();
    const cachePath = slideCachePath(id);
    insert.run(id, deckId, item.id, item.order_num, cachePath);
    records.push({
      id, deck_id: deckId, curriculum_id: item.id,
      order_num: item.order_num, cache_path: cachePath,
      status: 'pending', generated_at: null,
    });
  }

  return records;
}

export function getSlideRecords(deckId: string): SlideRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM slides WHERE deck_id = ? ORDER BY order_num').all(deckId) as SlideRecord[];
}

export function updateSlideStatus(slideId: string, status: SlideRecord['status']): void {
  const db = getDb();
  const generatedAt = status === 'ready' ? new Date().toISOString() : null;
  db.prepare('UPDATE slides SET status = ?, generated_at = ? WHERE id = ?').run(status, generatedAt, slideId);
}

export async function writeSlideContent(slideId: string, content: AISlide): Promise<void> {
  const cachePath = slideCachePath(slideId);
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(content, null, 2));
  updateSlideStatus(slideId, 'ready');
}

export async function readSlideContent(slideId: string): Promise<AISlide | null> {
  try {
    const cachePath = slideCachePath(slideId);
    const raw = await readFile(cachePath, 'utf-8');
    return JSON.parse(raw) as AISlide;
  } catch {
    return null;
  }
}

// ---- Full deck with slides content ----

export async function getFullDeck(deckId: string) {
  const deck = getDeck(deckId);
  if (!deck) return null;

  const curriculum = getCurriculumItems(deckId);
  const slideRecords = getSlideRecords(deckId);

  // Load slide content for ready slides
  const slides: (AISlide & { _status: string })[] = [];
  for (const record of slideRecords) {
    if (record.status === 'ready') {
      const content = await readSlideContent(record.id);
      if (content) {
        slides.push({ ...content, id: record.id, _status: 'ready' });
        continue;
      }
    }
    // Placeholder for non-ready slides
    slides.push({
      id: record.id,
      title: curriculum.find(c => c.id === record.curriculum_id)?.title ?? 'Generating...',
      headline: '',
      explanation: '',
      buildSteps: [],
      visuals: [],
      keyTakeaways: [],
      commands: [],
      speakerNotes: '',
      order: record.order_num,
      _status: record.status,
    });
  }

  return { deck, curriculum, slideRecords, slides };
}
