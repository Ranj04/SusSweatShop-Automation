import { db } from '../index';

export const introductionsRepo = {
  /**
   * Check if user has already introduced themselves
   */
  hasIntroduced(userId: string): boolean {
    const row = db.prepare('SELECT 1 FROM introductions WHERE user_id = ?').get(userId);
    return !!row;
  },

  /**
   * Mark user as having introduced themselves
   */
  markIntroduced(userId: string): void {
    db.prepare(`
      INSERT OR IGNORE INTO introductions (user_id) VALUES (?)
    `).run(userId);
  },

  /**
   * Get count of introductions
   */
  count(): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM introductions').get() as { count: number };
    return row.count;
  },
};
