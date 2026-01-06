import { db } from '../index';
import { getWeekNumber } from '../../utils/helpers';

export interface UserActivity {
  user_id: string;
  message_count: number;
}

export interface LeaderboardEntry {
  user_id: string;
  total_messages: number;
  rank: number;
}

export const activityRepo = {
  /**
   * Increment message count for a user in a channel
   */
  trackMessage(userId: string, channelId: string): void {
    const week = getWeekNumber();
    const year = new Date().getFullYear();

    db.prepare(`
      INSERT INTO activity (user_id, channel_id, week_number, year, message_count)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(user_id, channel_id, week_number, year)
      DO UPDATE SET message_count = message_count + 1
    `).run(userId, channelId, week, year);
  },

  /**
   * Get user's message count for current week
   */
  getUserWeeklyCount(userId: string): number {
    const week = getWeekNumber();
    const year = new Date().getFullYear();

    const row = db.prepare(`
      SELECT SUM(message_count) as total
      FROM activity
      WHERE user_id = ? AND week_number = ? AND year = ?
    `).get(userId, week, year) as { total: number | null };

    return row.total || 0;
  },

  /**
   * Get user's rank for current week
   */
  getUserRank(userId: string): number {
    const week = getWeekNumber();
    const year = new Date().getFullYear();

    const rows = db.prepare(`
      SELECT user_id, SUM(message_count) as total
      FROM activity
      WHERE week_number = ? AND year = ?
      GROUP BY user_id
      ORDER BY total DESC
    `).all(week, year) as { user_id: string; total: number }[];

    const index = rows.findIndex((r) => r.user_id === userId);
    return index === -1 ? rows.length + 1 : index + 1;
  },

  /**
   * Get leaderboard for current week
   */
  getWeeklyLeaderboard(limit: number = 10): LeaderboardEntry[] {
    const week = getWeekNumber();
    const year = new Date().getFullYear();

    const rows = db.prepare(`
      SELECT user_id, SUM(message_count) as total_messages
      FROM activity
      WHERE week_number = ? AND year = ?
      GROUP BY user_id
      ORDER BY total_messages DESC
      LIMIT ?
    `).all(week, year, limit) as { user_id: string; total_messages: number }[];

    return rows.map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
  },

  /**
   * Get last week's leaderboard (for Monday post)
   */
  getLastWeekLeaderboard(limit: number = 10): LeaderboardEntry[] {
    let week = getWeekNumber() - 1;
    let year = new Date().getFullYear();

    // Handle year boundary
    if (week < 1) {
      week = 52;
      year -= 1;
    }

    const rows = db.prepare(`
      SELECT user_id, SUM(message_count) as total_messages
      FROM activity
      WHERE week_number = ? AND year = ?
      GROUP BY user_id
      ORDER BY total_messages DESC
      LIMIT ?
    `).all(week, year, limit) as { user_id: string; total_messages: number }[];

    return rows.map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
  },

  /**
   * Get total message count for a user (all time)
   */
  getUserTotalCount(userId: string): number {
    const row = db.prepare(`
      SELECT SUM(message_count) as total
      FROM activity
      WHERE user_id = ?
    `).get(userId) as { total: number | null };

    return row.total || 0;
  },

  /**
   * Clean up old activity data (keep last 12 weeks)
   */
  cleanup(): number {
    const week = getWeekNumber();
    const year = new Date().getFullYear();

    // Calculate cutoff
    let cutoffWeek = week - 12;
    let cutoffYear = year;
    if (cutoffWeek < 1) {
      cutoffWeek += 52;
      cutoffYear -= 1;
    }

    const result = db.prepare(`
      DELETE FROM activity
      WHERE (year < ?) OR (year = ? AND week_number < ?)
    `).run(cutoffYear, cutoffYear, cutoffWeek);

    return result.changes;
  },
};
