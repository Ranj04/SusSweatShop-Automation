import Database, { Database as DatabaseType } from 'better-sqlite3';
import { config } from '../config';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

// Ensure data directory exists
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db: DatabaseType = new Database(config.dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

export function initializeDatabase(): void {
  logger.info('Initializing database...');

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Prompts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Polls table
  db.exec(`
    CREATE TABLE IF NOT EXISTS polls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Activity tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      week_number INTEGER NOT NULL,
      year INTEGER NOT NULL,
      message_count INTEGER DEFAULT 1,
      UNIQUE(user_id, channel_id, week_number, year)
    )
  `);

  // Subscriptions table (Whop integration)
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_user_id TEXT UNIQUE,
      whop_customer_id TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Premium nudge tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS premium_nudges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      posted_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Introduction tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS introductions (
      user_id TEXT PRIMARY KEY,
      introduced_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Bets table (for Pikkit CSV imports and manual tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT UNIQUE NOT NULL,
      source TEXT NOT NULL DEFAULT 'MANUAL',
      placed_at TEXT,
      settled_at TEXT,
      sport TEXT,
      league TEXT,
      market TEXT,
      pick TEXT,
      odds REAL,
      stake REAL,
      payout REAL,
      profit REAL,
      result TEXT,
      book TEXT,
      visibility TEXT NOT NULL DEFAULT 'STAFF',
      tags TEXT,
      raw_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      created_by TEXT,
      notes TEXT,
      game_date TEXT
    )
  `);

  // Add columns if they don't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE bets ADD COLUMN created_by TEXT`);
  } catch { /* column exists */ }
  try {
    db.exec(`ALTER TABLE bets ADD COLUMN notes TEXT`);
  } catch { /* column exists */ }
  try {
    db.exec(`ALTER TABLE bets ADD COLUMN game_date TEXT`);
  } catch { /* column exists */ }

  // Create index on bets for common queries
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bets_settled_at ON bets(settled_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bets_visibility ON bets(visibility)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bets_hash ON bets(hash)`);

  // CSV column mappings
  db.exec(`
    CREATE TABLE IF NOT EXISTS csv_mappings (
      internal_field TEXT PRIMARY KEY,
      csv_column TEXT NOT NULL
    )
  `);

  // Recap post tracking (to avoid duplicate posts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS recap_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      posted_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Insert default prompts if empty
  const promptCount = db.prepare('SELECT COUNT(*) as count FROM prompts').get() as { count: number };
  if (promptCount.count === 0) {
    insertDefaultPrompts();
  }

  // Insert default polls if empty
  const pollCount = db.prepare('SELECT COUNT(*) as count FROM polls').get() as { count: number };
  if (pollCount.count === 0) {
    insertDefaultPolls();
  }

  logger.info('Database initialized successfully');
}

function insertDefaultPrompts(): void {
  const defaultPrompts = [
    "What's your {sport} lock of the day?",
    "Share your best {sport} play for tonight!",
    "Who's riding with us on {sport} tonight?",
    "Drop your {sport} leans below - let's discuss!",
    "What {sport} trends are you seeing this week?",
    "Any {sport} unders you like tonight?",
    "What's your go-to {sport} bet type?",
    "Share a {sport} stat that surprised you recently!",
    "Who's your favorite {sport} player to bet on?",
    "What {sport} game has the most value tonight?",
  ];

  const insert = db.prepare('INSERT INTO prompts (text) VALUES (?)');
  for (const prompt of defaultPrompts) {
    insert.run(prompt);
  }
  logger.info(`Inserted ${defaultPrompts.length} default prompts`);
}

function insertDefaultPolls(): void {
  const defaultPolls = [
    { question: "What's your favorite play tonight?", options: ["Player Prop", "Spread", "Moneyline", "Total"] },
    { question: "Tail or fade our lean?", options: ["Tail", "Fade", "Waiting for more info"] },
    { question: "Which game are you sweating most?", options: ["Early slate", "Primetime", "Late night"] },
    { question: "How's your week going?", options: ["Crushing it", "Breaking even", "Rebuilding", "Just vibing"] },
    { question: "Best value bet type this week?", options: ["Props", "Alt lines", "Parlays", "Straight bets"] },
    { question: "How many units are you risking tonight?", options: ["1-2 units", "3-5 units", "5+ units", "Taking the night off"] },
  ];

  const insert = db.prepare('INSERT INTO polls (question, options) VALUES (?, ?)');
  for (const poll of defaultPolls) {
    insert.run(poll.question, JSON.stringify(poll.options));
  }
  logger.info(`Inserted ${defaultPolls.length} default polls`);
}

export function closeDatabase(): void {
  db.close();
  logger.info('Database connection closed');
}
