import { db } from '../index';

export interface Poll {
  id: number;
  question: string;
  options: string[]; // Parsed from JSON
  created_at: string;
}

interface PollRow {
  id: number;
  question: string;
  options: string; // JSON string
  created_at: string;
}

function parseRow(row: PollRow): Poll {
  return {
    ...row,
    options: JSON.parse(row.options),
  };
}

export const pollsRepo = {
  getAll(): Poll[] {
    const rows = db.prepare('SELECT * FROM polls ORDER BY id').all() as PollRow[];
    return rows.map(parseRow);
  },

  getRandom(): Poll | undefined {
    const row = db.prepare('SELECT * FROM polls ORDER BY RANDOM() LIMIT 1').get() as PollRow | undefined;
    return row ? parseRow(row) : undefined;
  },

  add(question: string, options: string[]): number {
    const result = db.prepare('INSERT INTO polls (question, options) VALUES (?, ?)').run(
      question,
      JSON.stringify(options)
    );
    return result.lastInsertRowid as number;
  },

  delete(id: number): boolean {
    const result = db.prepare('DELETE FROM polls WHERE id = ?').run(id);
    return result.changes > 0;
  },

  count(): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM polls').get() as { count: number };
    return row.count;
  },
};
