import { db } from '../index';

export interface Prompt {
  id: number;
  text: string;
  created_at: string;
}

export const promptsRepo = {
  getAll(): Prompt[] {
    return db.prepare('SELECT * FROM prompts ORDER BY id').all() as Prompt[];
  },

  getRandom(): Prompt | undefined {
    return db.prepare('SELECT * FROM prompts ORDER BY RANDOM() LIMIT 1').get() as Prompt | undefined;
  },

  add(text: string): number {
    const result = db.prepare('INSERT INTO prompts (text) VALUES (?)').run(text);
    return result.lastInsertRowid as number;
  },

  delete(id: number): boolean {
    const result = db.prepare('DELETE FROM prompts WHERE id = ?').run(id);
    return result.changes > 0;
  },

  count(): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM prompts').get() as { count: number };
    return row.count;
  },
};
