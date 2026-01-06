import { db } from '../index';

export const premiumNudgesRepo = {
  /**
   * Get the last nudge timestamp
   */
  getLastNudge(): Date | null {
    const row = db.prepare(`
      SELECT posted_at FROM premium_nudges ORDER BY id DESC LIMIT 1
    `).get() as { posted_at: string } | undefined;

    return row ? new Date(row.posted_at) : null;
  },

  /**
   * Check if enough time has passed since last nudge (7 days)
   */
  canPostNudge(): boolean {
    const lastNudge = this.getLastNudge();
    if (!lastNudge) return true;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return lastNudge < sevenDaysAgo;
  },

  /**
   * Record a new nudge
   */
  recordNudge(): void {
    db.prepare('INSERT INTO premium_nudges DEFAULT VALUES').run();
  },

  /**
   * Cleanup old records (keep last 10)
   */
  cleanup(): void {
    db.prepare(`
      DELETE FROM premium_nudges
      WHERE id NOT IN (SELECT id FROM premium_nudges ORDER BY id DESC LIMIT 10)
    `).run();
  },
};
