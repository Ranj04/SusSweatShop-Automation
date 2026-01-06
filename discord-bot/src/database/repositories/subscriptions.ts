import { db } from '../index';

export interface Subscription {
  id: number;
  discord_user_id: string;
  whop_customer_id: string;
  status: 'active' | 'canceled' | 'expired';
  created_at: string;
  updated_at: string;
}

export const subscriptionsRepo = {
  /**
   * Find subscription by Discord user ID
   */
  findByDiscordId(discordUserId: string): Subscription | undefined {
    return db.prepare(`
      SELECT * FROM subscriptions WHERE discord_user_id = ?
    `).get(discordUserId) as Subscription | undefined;
  },

  /**
   * Find subscription by Whop customer ID
   */
  findByWhopId(whopCustomerId: string): Subscription | undefined {
    return db.prepare(`
      SELECT * FROM subscriptions WHERE whop_customer_id = ?
    `).get(whopCustomerId) as Subscription | undefined;
  },

  /**
   * Create or update subscription
   */
  upsert(discordUserId: string, whopCustomerId: string, status: 'active' | 'canceled' | 'expired'): void {
    db.prepare(`
      INSERT INTO subscriptions (discord_user_id, whop_customer_id, status, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(discord_user_id) DO UPDATE SET
        whop_customer_id = ?,
        status = ?,
        updated_at = datetime('now')
    `).run(discordUserId, whopCustomerId, status, whopCustomerId, status);
  },

  /**
   * Update subscription status
   */
  updateStatus(whopCustomerId: string, status: 'active' | 'canceled' | 'expired'): boolean {
    const result = db.prepare(`
      UPDATE subscriptions
      SET status = ?, updated_at = datetime('now')
      WHERE whop_customer_id = ?
    `).run(status, whopCustomerId);
    return result.changes > 0;
  },

  /**
   * Get all active subscriptions
   */
  getActive(): Subscription[] {
    return db.prepare(`
      SELECT * FROM subscriptions WHERE status = 'active'
    `).all() as Subscription[];
  },

  /**
   * Delete subscription
   */
  delete(whopCustomerId: string): boolean {
    const result = db.prepare(`
      DELETE FROM subscriptions WHERE whop_customer_id = ?
    `).run(whopCustomerId);
    return result.changes > 0;
  },
};
