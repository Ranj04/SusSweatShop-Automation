import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

export const config = {
  // Discord
  discord: {
    token: process.env.DISCORD_TOKEN!,
    clientId: process.env.DISCORD_CLIENT_ID!,
    guildId: process.env.DISCORD_GUILD_ID!,
  },

  // Whop
  whop: {
    webhookSecret: process.env.WHOP_WEBHOOK_SECRET || '',
    link: process.env.WHOP_LINK || 'https://whop.com/your-product',
  },

  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  timezone: process.env.TIMEZONE || 'America/New_York',

  // Default schedule times (can be overridden in DB)
  defaults: {
    promptTimes: ['10:00', '16:00', '19:00'],
    pollTime: '12:00',
    sweatThreadTime: '17:00',
    leaderboardTime: '09:00', // Monday only
    premiumNudgeDay: 0, // Sunday
  },

  // Sport day mapping (default)
  sportDays: {
    0: 'NFL', // Sunday
    1: 'NBA', // Monday
    2: 'NBA', // Tuesday
    3: 'NBA', // Wednesday
    4: 'NFL', // Thursday
    5: 'NBA', // Friday
    6: 'CFB', // Saturday (College Football)
  } as Record<number, string>,

  // Database
  dbPath: './data/bot.db',
} as const;

// Validate required config
export function validateConfig(): void {
  const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
