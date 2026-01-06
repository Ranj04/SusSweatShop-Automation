import { db } from '../index';

export type BetResult = 'WIN' | 'LOSS' | 'PUSH' | 'PENDING' | 'VOID';
export type BetVisibility = 'FREE' | 'PREMIUM' | 'STAFF';

export interface Bet {
  id: number;
  hash: string;
  source: string;
  placed_at: string | null;
  settled_at: string | null;
  sport: string | null;
  league: string | null;
  market: string | null;
  pick: string | null;
  odds: number | null;
  stake: number | null;
  payout: number | null;
  profit: number | null;
  result: BetResult | null;
  book: string | null;
  visibility: BetVisibility;
  tags: string | null;
  raw_data: string;
  created_at: string;
  created_by: string | null;
  notes: string | null;
  game_date: string | null;
}

export interface BetStats {
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  totalStake: number;
  totalProfit: number;
  roi: number;
}

export interface BetBreakdown {
  category: string;
  wins: number;
  losses: number;
  pushes: number;
  profit: number;
}

export const betsRepo = {
  /**
   * Check if a bet with this hash already exists
   */
  existsByHash(hash: string): boolean {
    const row = db.prepare('SELECT 1 FROM bets WHERE hash = ?').get(hash);
    return !!row;
  },

  /**
   * Insert a new bet record
   */
  insert(bet: Omit<Bet, 'id' | 'created_at'>): number {
    const result = db.prepare(`
      INSERT INTO bets (
        hash, source, placed_at, settled_at, sport, league, market, pick,
        odds, stake, payout, profit, result, book, visibility, tags, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bet.hash,
      bet.source,
      bet.placed_at,
      bet.settled_at,
      bet.sport,
      bet.league,
      bet.market,
      bet.pick,
      bet.odds,
      bet.stake,
      bet.payout,
      bet.profit,
      bet.result,
      bet.book,
      bet.visibility,
      bet.tags,
      bet.raw_data
    );
    return result.lastInsertRowid as number;
  },

  /**
   * Bulk insert bets (returns count of inserted)
   */
  bulkInsert(bets: Omit<Bet, 'id' | 'created_at'>[]): number {
    const insert = db.prepare(`
      INSERT INTO bets (
        hash, source, placed_at, settled_at, sport, league, market, pick,
        odds, stake, payout, profit, result, book, visibility, tags, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    const transaction = db.transaction((bets: Omit<Bet, 'id' | 'created_at'>[]) => {
      for (const bet of bets) {
        // Skip if hash exists
        if (this.existsByHash(bet.hash)) continue;

        insert.run(
          bet.hash,
          bet.source,
          bet.placed_at,
          bet.settled_at,
          bet.sport,
          bet.league,
          bet.market,
          bet.pick,
          bet.odds,
          bet.stake,
          bet.payout,
          bet.profit,
          bet.result,
          bet.book,
          bet.visibility,
          bet.tags,
          bet.raw_data
        );
        inserted++;
      }
    });

    transaction(bets);
    return inserted;
  },

  /**
   * Get bet by ID
   */
  getById(id: number): Bet | undefined {
    return db.prepare('SELECT * FROM bets WHERE id = ?').get(id) as Bet | undefined;
  },

  /**
   * Update bet visibility
   */
  updateVisibility(id: number, visibility: BetVisibility): boolean {
    const result = db.prepare('UPDATE bets SET visibility = ? WHERE id = ?').run(visibility, id);
    return result.changes > 0;
  },

  /**
   * Bulk update visibility by date
   */
  bulkUpdateVisibilityByDate(date: string, visibility: BetVisibility): number {
    const result = db.prepare(`
      UPDATE bets
      SET visibility = ?
      WHERE DATE(COALESCE(settled_at, placed_at)) = ?
    `).run(visibility, date);
    return result.changes;
  },

  /**
   * Get settled bets for a date range with visibility filter
   */
  getSettledBets(
    startDate: string,
    endDate: string,
    visibility: BetVisibility
  ): Bet[] {
    let visibilityFilter: string;

    switch (visibility) {
      case 'FREE':
        visibilityFilter = "visibility = 'FREE'";
        break;
      case 'PREMIUM':
        visibilityFilter = "visibility IN ('FREE', 'PREMIUM')";
        break;
      case 'STAFF':
        visibilityFilter = "1=1"; // All bets
        break;
    }

    return db.prepare(`
      SELECT * FROM bets
      WHERE DATE(settled_at) BETWEEN ? AND ?
        AND result IN ('WIN', 'LOSS', 'PUSH')
        AND ${visibilityFilter}
      ORDER BY settled_at ASC
    `).all(startDate, endDate) as Bet[];
  },

  /**
   * Get bets settled on a specific date
   */
  getSettledByDate(date: string, visibility: BetVisibility): Bet[] {
    return this.getSettledBets(date, date, visibility);
  },

  /**
   * Calculate stats for a set of bets
   */
  calculateStats(bets: Bet[]): BetStats {
    let wins = 0, losses = 0, pushes = 0, pending = 0;
    let totalStake = 0, totalProfit = 0;

    for (const bet of bets) {
      const stake = bet.stake || 0;
      const profit = bet.profit || 0;

      switch (bet.result) {
        case 'WIN':
          wins++;
          totalStake += stake;
          totalProfit += profit;
          break;
        case 'LOSS':
          losses++;
          totalStake += stake;
          totalProfit += profit; // profit is negative for losses
          break;
        case 'PUSH':
          pushes++;
          break;
        case 'PENDING':
          pending++;
          break;
      }
    }

    const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;

    return { wins, losses, pushes, pending, totalStake, totalProfit, roi };
  },

  /**
   * Get breakdown by sport
   */
  getBreakdownBySport(bets: Bet[]): BetBreakdown[] {
    const breakdown = new Map<string, BetBreakdown>();

    for (const bet of bets) {
      const sport = bet.sport || 'Unknown';

      if (!breakdown.has(sport)) {
        breakdown.set(sport, { category: sport, wins: 0, losses: 0, pushes: 0, profit: 0 });
      }

      const entry = breakdown.get(sport)!;
      switch (bet.result) {
        case 'WIN':
          entry.wins++;
          entry.profit += bet.profit || 0;
          break;
        case 'LOSS':
          entry.losses++;
          entry.profit += bet.profit || 0;
          break;
        case 'PUSH':
          entry.pushes++;
          break;
      }
    }

    return Array.from(breakdown.values()).sort((a, b) =>
      (b.wins + b.losses) - (a.wins + a.losses)
    );
  },

  /**
   * Get breakdown by market type
   */
  getBreakdownByMarket(bets: Bet[]): BetBreakdown[] {
    const breakdown = new Map<string, BetBreakdown>();

    for (const bet of bets) {
      let market = bet.market || 'Unknown';

      // Normalize common market types
      const marketLower = market.toLowerCase();
      if (marketLower.includes('moneyline') || marketLower === 'ml') {
        market = 'Moneyline';
      } else if (marketLower.includes('spread') || marketLower.includes('point')) {
        market = 'Spread';
      } else if (marketLower.includes('total') || marketLower.includes('over') || marketLower.includes('under')) {
        market = 'Total';
      } else if (marketLower.includes('prop') || marketLower.includes('player')) {
        market = 'Props';
      } else if (marketLower.includes('parlay')) {
        market = 'Parlay';
      }

      if (!breakdown.has(market)) {
        breakdown.set(market, { category: market, wins: 0, losses: 0, pushes: 0, profit: 0 });
      }

      const entry = breakdown.get(market)!;
      switch (bet.result) {
        case 'WIN':
          entry.wins++;
          entry.profit += bet.profit || 0;
          break;
        case 'LOSS':
          entry.losses++;
          entry.profit += bet.profit || 0;
          break;
        case 'PUSH':
          entry.pushes++;
          break;
      }
    }

    return Array.from(breakdown.values()).sort((a, b) =>
      (b.wins + b.losses) - (a.wins + a.losses)
    );
  },

  /**
   * Check if recap was already posted for a date
   */
  hasPostedRecapForDate(date: string): boolean {
    const row = db.prepare('SELECT 1 FROM recap_posts WHERE date = ?').get(date);
    return !!row;
  },

  /**
   * Record that recap was posted for a date
   */
  recordRecapPost(date: string, channelId: string, messageId: string): void {
    db.prepare(`
      INSERT INTO recap_posts (date, channel_id, message_id)
      VALUES (?, ?, ?)
    `).run(date, channelId, messageId);
  },

  /**
   * Get total bet count
   */
  count(): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM bets').get() as { count: number };
    return row.count;
  },

  /**
   * Get bets by date for display
   */
  getBetsByDate(date: string): Bet[] {
    return db.prepare(`
      SELECT * FROM bets
      WHERE DATE(COALESCE(settled_at, placed_at)) = ?
      ORDER BY id ASC
    `).all(date) as Bet[];
  },

  /**
   * Get pending bets for a specific date (for card posting)
   */
  getPendingBetsByDate(date: string, visibility?: BetVisibility): Bet[] {
    let query = `
      SELECT * FROM bets
      WHERE DATE(COALESCE(game_date, placed_at)) = ?
        AND result = 'PENDING'
    `;

    if (visibility) {
      if (visibility === 'FREE') {
        query += " AND visibility = 'FREE'";
      } else if (visibility === 'PREMIUM') {
        query += " AND visibility IN ('FREE', 'PREMIUM')";
      }
      // STAFF = all bets
    }

    query += ' ORDER BY sport, id ASC';

    return db.prepare(query).all(date) as Bet[];
  },

  /**
   * Get pending bets (all)
   */
  getPendingBets(): Bet[] {
    return db.prepare(`
      SELECT * FROM bets
      WHERE result = 'PENDING'
      ORDER BY placed_at DESC
    `).all() as Bet[];
  },

  /**
   * Grade a bet and calculate profit
   */
  gradeBet(
    id: number,
    result: BetResult,
    settledOdds?: number,
    settledAt?: string
  ): { success: boolean; profit: number } {
    const bet = this.getById(id);
    if (!bet) {
      return { success: false, profit: 0 };
    }

    const odds = settledOdds ?? bet.odds ?? 0;
    const stake = bet.stake ?? 0;
    let profit = 0;

    // Calculate profit based on American odds
    if (result === 'WIN') {
      if (odds < 0) {
        // Favorite: profit = stake * (100 / |odds|)
        profit = stake * (100 / Math.abs(odds));
      } else {
        // Underdog: profit = stake * (odds / 100)
        profit = stake * (odds / 100);
      }
    } else if (result === 'LOSS') {
      profit = -stake;
    } else {
      // PUSH or VOID = 0
      profit = 0;
    }

    // Round to 2 decimal places
    profit = Math.round(profit * 100) / 100;

    const finalSettledAt = settledAt || new Date().toISOString().split('T')[0];

    db.prepare(`
      UPDATE bets
      SET result = ?, profit = ?, settled_at = ?, odds = COALESCE(?, odds)
      WHERE id = ?
    `).run(result, profit, finalSettledAt, settledOdds, id);

    return { success: true, profit };
  },

  /**
   * Get bets created by a specific user
   */
  getBetsByCreator(userId: string, limit: number = 50): Bet[] {
    return db.prepare(`
      SELECT * FROM bets
      WHERE created_by = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, limit) as Bet[];
  },

  /**
   * Get bets for a date range (for stats)
   */
  getBetsInRange(
    startDate: string,
    endDate: string,
    visibility?: BetVisibility
  ): Bet[] {
    let visibilityFilter = '1=1';
    if (visibility === 'FREE') {
      visibilityFilter = "visibility = 'FREE'";
    } else if (visibility === 'PREMIUM') {
      visibilityFilter = "visibility IN ('FREE', 'PREMIUM')";
    }

    return db.prepare(`
      SELECT * FROM bets
      WHERE DATE(COALESCE(settled_at, placed_at)) BETWEEN ? AND ?
        AND ${visibilityFilter}
      ORDER BY placed_at ASC
    `).all(startDate, endDate) as Bet[];
  },

  /**
   * Insert a manually logged bet
   */
  logBet(bet: {
    sport: string;
    market: string;
    pick: string;
    odds: number;
    stake: number;
    book?: string;
    gameDate?: string;
    notes?: string;
    visibility: BetVisibility;
    createdBy: string;
  }): number {
    const now = new Date().toISOString();
    const hash = `MANUAL_${bet.createdBy}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const result = db.prepare(`
      INSERT INTO bets (
        hash, source, placed_at, sport, market, pick, odds, stake,
        result, book, visibility, created_by, notes, game_date, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      hash,
      'MANUAL',
      now,
      bet.sport,
      bet.market,
      bet.pick,
      bet.odds,
      bet.stake,
      'PENDING',
      bet.book || null,
      bet.visibility,
      bet.createdBy,
      bet.notes || null,
      bet.gameDate || null,
      JSON.stringify(bet)
    );

    return result.lastInsertRowid as number;
  },
};
