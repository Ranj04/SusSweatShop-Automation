import crypto from 'crypto';
import { Bet, BetResult, BetVisibility } from '../database/repositories/bets';
import { csvMappingsRepo, InternalField } from '../database/repositories/csvMappings';
import { logger } from './logger';

export interface CsvRow {
  [key: string]: string;
}

export interface ParsedBet {
  bet: Omit<Bet, 'id' | 'created_at'>;
  rowIndex: number;
  errors: string[];
}

export interface CsvParseResult {
  headers: string[];
  rows: CsvRow[];
  errors: string[];
}

/**
 * Parse CSV content with proper handling of quotes and commas
 */
export function parseCSV(content: string): CsvParseResult {
  const errors: string[] = [];
  const lines = content.split(/\r?\n/);

  if (lines.length === 0) {
    return { headers: [], rows: [], errors: ['Empty CSV file'] };
  }

  // Parse header row
  const headers = parseCsvLine(lines[0]);

  if (headers.length === 0) {
    return { headers: [], rows: [], errors: ['No headers found in CSV'] };
  }

  // Parse data rows
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    try {
      const values = parseCsvLine(line);

      // Create row object with header keys
      const row: CsvRow = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] || '';
      }

      rows.push(row);
    } catch (error) {
      errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
    }
  }

  return { headers, rows, errors };
}

/**
 * Parse a single CSV line handling quotes and escaped characters
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        // End of quoted section
        inQuotes = false;
        i++;
        continue;
      }
      current += char;
      i++;
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (char === ',') {
        result.push(current.trim());
        current = '';
        i++;
        continue;
      }
      current += char;
      i++;
    }
  }

  // Push last field
  result.push(current.trim());

  return result;
}

/**
 * Compute SHA256 hash for a bet row to detect duplicates
 */
export function computeBetHash(row: CsvRow, keyFields: string[]): string {
  // Build a string from key fields
  const parts: string[] = [];

  for (const field of keyFields) {
    const value = row[field] || '';
    parts.push(`${field}:${value}`);
  }

  const content = parts.join('|');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Normalize result string to standard format
 */
function normalizeResult(result: string | undefined): BetResult | null {
  if (!result) return null;

  const normalized = result.toLowerCase().trim();

  if (['win', 'won', 'w', 'winner', 'hit'].includes(normalized)) {
    return 'WIN';
  }
  if (['loss', 'lost', 'l', 'loser', 'miss'].includes(normalized)) {
    return 'LOSS';
  }
  if (['push', 'tie', 'draw', 'refund', 'void', 'cancelled'].includes(normalized)) {
    return 'PUSH';
  }
  if (['pending', 'open', 'unsettled', 'active'].includes(normalized)) {
    return 'PENDING';
  }

  return null;
}

/**
 * Parse date string to ISO format
 */
function parseDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;

  try {
    // Try parsing various formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // Ignore parsing errors
  }

  return null;
}

/**
 * Parse numeric value (handles various formats)
 */
function parseNumber(value: string | undefined): number | null {
  if (!value) return null;

  // Remove currency symbols, commas, and whitespace
  const cleaned = value.replace(/[$€£,\s]/g, '').trim();

  // Handle parentheses for negative numbers
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
  const numStr = isNegative ? cleaned.slice(1, -1) : cleaned;

  const num = parseFloat(numStr);
  if (isNaN(num)) return null;

  return isNegative ? -num : num;
}

/**
 * Determine visibility based on tags or public flag
 */
function determineVisibility(row: CsvRow, mapping: Map<InternalField, string>): BetVisibility {
  // Check explicit visibility column
  const visibilityCol = mapping.get('visibility');
  if (visibilityCol && row[visibilityCol]) {
    const vis = row[visibilityCol].toUpperCase().trim();
    if (['FREE', 'PREMIUM', 'STAFF'].includes(vis)) {
      return vis as BetVisibility;
    }
  }

  // Check tags column for shared/public indicators
  const tagsCol = mapping.get('tags');
  if (tagsCol && row[tagsCol]) {
    const tags = row[tagsCol].toLowerCase();
    if (tags.includes('free') || tags.includes('public') || tags.includes('shared')) {
      return 'FREE';
    }
    if (tags.includes('premium') || tags.includes('vip')) {
      return 'PREMIUM';
    }
  }

  // Default to STAFF (private) until explicitly marked
  return 'STAFF';
}

/**
 * Convert a CSV row to a Bet object
 */
export function rowToBet(
  row: CsvRow,
  mapping: Map<InternalField, string>,
  rowIndex: number
): ParsedBet {
  const errors: string[] = [];

  // Get values using mapping
  const getValue = (field: InternalField): string | undefined => {
    const col = mapping.get(field);
    return col ? row[col] : undefined;
  };

  // Determine key fields for hashing (use available identifying fields)
  const keyFields: string[] = [];
  for (const field of ['placed_at', 'pick', 'odds', 'stake', 'book'] as InternalField[]) {
    const col = mapping.get(field);
    if (col && row[col]) {
      keyFields.push(col);
    }
  }

  // If not enough key fields, use all non-empty columns
  if (keyFields.length < 3) {
    for (const [key, value] of Object.entries(row)) {
      if (value && !keyFields.includes(key)) {
        keyFields.push(key);
      }
    }
  }

  const hash = computeBetHash(row, keyFields);

  // Parse fields
  const placedAt = parseDate(getValue('placed_at'));
  const settledAt = parseDate(getValue('settled_at'));
  const odds = parseNumber(getValue('odds'));
  const stake = parseNumber(getValue('stake'));
  const payout = parseNumber(getValue('payout'));
  let profit = parseNumber(getValue('profit'));
  const result = normalizeResult(getValue('result'));

  // Calculate profit if not provided but we have stake and result
  if (profit === null && stake !== null && result) {
    if (result === 'WIN' && payout !== null) {
      profit = payout - stake;
    } else if (result === 'LOSS') {
      profit = -stake;
    } else if (result === 'PUSH') {
      profit = 0;
    }
  }

  // Validate required fields
  if (!getValue('pick') && !getValue('market')) {
    errors.push('Missing pick/selection description');
  }

  const bet: Omit<Bet, 'id' | 'created_at'> = {
    hash,
    source: 'PIKKIT_CSV',
    placed_at: placedAt,
    settled_at: settledAt,
    sport: getValue('sport') || null,
    league: getValue('league') || null,
    market: getValue('market') || null,
    pick: getValue('pick') || null,
    odds,
    stake,
    payout,
    profit,
    result,
    book: getValue('book') || null,
    visibility: determineVisibility(row, mapping),
    tags: getValue('tags') || null,
    raw_data: JSON.stringify(row),
    created_by: null,
    notes: null,
    game_date: null,
  };

  return { bet, rowIndex, errors };
}

/**
 * Process entire CSV content and return parsed bets
 */
export function processCSV(content: string): {
  bets: Omit<Bet, 'id' | 'created_at'>[];
  headers: string[];
  mapping: Map<InternalField, string>;
  errors: string[];
  skipped: number;
} {
  const { headers, rows, errors: parseErrors } = parseCSV(content);
  const errors = [...parseErrors];
  const bets: Omit<Bet, 'id' | 'created_at'>[] = [];
  let skipped = 0;

  if (headers.length === 0 || rows.length === 0) {
    return { bets: [], headers, mapping: new Map(), errors, skipped };
  }

  // Build mapping from headers
  const mapping = csvMappingsRepo.buildMappingFromHeaders(headers);

  logger.debug('CSV column mapping:', Object.fromEntries(mapping));

  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const { bet, errors: rowErrors } = rowToBet(rows[i], mapping, i);

    if (rowErrors.length > 0) {
      errors.push(`Row ${i + 2}: ${rowErrors.join(', ')}`);
      skipped++;
      continue;
    }

    bets.push(bet);
  }

  return { bets, headers, mapping, errors, skipped };
}
