import { db } from '../index';

/**
 * Internal field names that can be mapped from CSV columns
 */
export const INTERNAL_FIELDS = [
  'placed_at',
  'settled_at',
  'sport',
  'league',
  'market',
  'pick',
  'odds',
  'stake',
  'payout',
  'profit',
  'result',
  'book',
  'tags',
  'visibility',
] as const;

export type InternalField = typeof INTERNAL_FIELDS[number];

export interface CsvMapping {
  internal_field: InternalField;
  csv_column: string;
}

/**
 * Default mappings for common Pikkit CSV column names
 */
export const DEFAULT_MAPPINGS: Record<InternalField, string[]> = {
  placed_at: ['placed_at', 'placed', 'date_placed', 'created_at', 'created', 'date'],
  settled_at: ['settled_at', 'settled', 'date_settled', 'graded_at', 'graded', 'result_date'],
  sport: ['sport', 'sport_name', 'category'],
  league: ['league', 'league_name', 'competition'],
  market: ['market', 'market_type', 'bet_type', 'type', 'wager_type'],
  pick: ['pick', 'selection', 'description', 'bet', 'wager', 'pick_description', 'leg'],
  odds: ['odds', 'price', 'american_odds', 'decimal_odds', 'line'],
  stake: ['stake', 'units', 'risk', 'wager_amount', 'bet_amount', 'amount'],
  payout: ['payout', 'to_win', 'potential_payout', 'win_amount'],
  profit: ['profit', 'profit_loss', 'pnl', 'net', 'return', 'winnings'],
  result: ['result', 'status', 'outcome', 'grade', 'settlement'],
  book: ['book', 'sportsbook', 'bookmaker', 'bookie', 'operator'],
  tags: ['tags', 'tag', 'labels', 'category', 'shared'],
  visibility: ['visibility', 'tier', 'access', 'public'],
};

export const csvMappingsRepo = {
  /**
   * Get mapping for an internal field
   */
  getMapping(internalField: InternalField): string | undefined {
    const row = db.prepare(`
      SELECT csv_column FROM csv_mappings WHERE internal_field = ?
    `).get(internalField) as { csv_column: string } | undefined;
    return row?.csv_column;
  },

  /**
   * Get all mappings
   */
  getAllMappings(): CsvMapping[] {
    return db.prepare('SELECT * FROM csv_mappings').all() as CsvMapping[];
  },

  /**
   * Set mapping for an internal field
   */
  setMapping(internalField: InternalField, csvColumn: string): void {
    db.prepare(`
      INSERT INTO csv_mappings (internal_field, csv_column)
      VALUES (?, ?)
      ON CONFLICT(internal_field) DO UPDATE SET csv_column = ?
    `).run(internalField, csvColumn, csvColumn);
  },

  /**
   * Delete a mapping
   */
  deleteMapping(internalField: InternalField): boolean {
    const result = db.prepare('DELETE FROM csv_mappings WHERE internal_field = ?').run(internalField);
    return result.changes > 0;
  },

  /**
   * Find the best matching column from CSV headers for an internal field
   * Uses configured mapping first, then falls back to defaults
   */
  findColumnForField(internalField: InternalField, headers: string[]): string | undefined {
    // Normalize headers for comparison
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_'));
    const headerMap = new Map<string, string>();
    headers.forEach((h, i) => headerMap.set(normalizedHeaders[i], h));

    // Check configured mapping first
    const configuredMapping = this.getMapping(internalField);
    if (configuredMapping) {
      const normalizedConfig = configuredMapping.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
      if (normalizedHeaders.includes(normalizedConfig)) {
        return headerMap.get(normalizedConfig);
      }
      // Also try exact match
      if (headers.includes(configuredMapping)) {
        return configuredMapping;
      }
    }

    // Fall back to defaults
    const defaults = DEFAULT_MAPPINGS[internalField];
    for (const defaultCol of defaults) {
      const normalized = defaultCol.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (normalizedHeaders.includes(normalized)) {
        return headerMap.get(normalized);
      }
    }

    return undefined;
  },

  /**
   * Build a complete mapping from CSV headers
   */
  buildMappingFromHeaders(headers: string[]): Map<InternalField, string> {
    const mapping = new Map<InternalField, string>();

    for (const field of INTERNAL_FIELDS) {
      const column = this.findColumnForField(field, headers);
      if (column) {
        mapping.set(field, column);
      }
    }

    return mapping;
  },

  /**
   * Reset all mappings to default
   */
  resetToDefaults(): void {
    db.prepare('DELETE FROM csv_mappings').run();
  },
};
