import { db } from '../index';

export interface BotSettings {
  welcomeChannelId?: string;
  introductionsChannelId?: string;
  promptsChannelId?: string;
  pollsChannelId?: string;
  sweatsChannelId?: string;
  announcementsChannelId?: string;
  freePicksChannelId?: string;
  premiumPicksChannelId?: string;
  memberRoleId?: string;
  premiumRoleId?: string;
  topContributorRoleId?: string;
  promptTimes?: string[];
  pollTime?: string;
  sweatThreadTime?: string;
  recapTime?: string;
  sportDays?: Record<number, string>;
  trackedChannels?: string[];
}

const SETTINGS_KEYS: (keyof BotSettings)[] = [
  'welcomeChannelId',
  'introductionsChannelId',
  'promptsChannelId',
  'pollsChannelId',
  'sweatsChannelId',
  'announcementsChannelId',
  'freePicksChannelId',
  'premiumPicksChannelId',
  'memberRoleId',
  'premiumRoleId',
  'topContributorRoleId',
  'promptTimes',
  'pollTime',
  'sweatThreadTime',
  'recapTime',
  'sportDays',
  'trackedChannels',
];

export const settingsRepo = {
  get(key: keyof BotSettings): string | undefined {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  },

  getJson<T>(key: keyof BotSettings): T | undefined {
    const value = this.get(key);
    if (!value) return undefined;
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  },

  set(key: keyof BotSettings, value: string): void {
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
    `).run(key, value, value);
  },

  setJson(key: keyof BotSettings, value: unknown): void {
    this.set(key, JSON.stringify(value));
  },

  getAll(): BotSettings {
    const settings: BotSettings = {};
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];

    for (const row of rows) {
      const key = row.key as keyof BotSettings;
      if (!SETTINGS_KEYS.includes(key)) continue;

      // Parse JSON values
      if (['promptTimes', 'sportDays', 'trackedChannels'].includes(key)) {
        try {
          (settings as Record<string, unknown>)[key] = JSON.parse(row.value);
        } catch {
          (settings as Record<string, unknown>)[key] = row.value;
        }
      } else {
        (settings as Record<string, unknown>)[key] = row.value;
      }
    }

    return settings;
  },

  getChannelId(type: 'welcome' | 'introductions' | 'prompts' | 'polls' | 'sweats' | 'announcements' | 'freePicks' | 'premiumPicks'): string | undefined {
    const keyMap: Record<string, keyof BotSettings> = {
      welcome: 'welcomeChannelId',
      introductions: 'introductionsChannelId',
      prompts: 'promptsChannelId',
      polls: 'pollsChannelId',
      sweats: 'sweatsChannelId',
      announcements: 'announcementsChannelId',
      freePicks: 'freePicksChannelId',
      premiumPicks: 'premiumPicksChannelId',
    };
    return this.get(keyMap[type]);
  },

  setChannelId(type: 'welcome' | 'introductions' | 'prompts' | 'polls' | 'sweats' | 'announcements' | 'freePicks' | 'premiumPicks', channelId: string): void {
    const keyMap: Record<string, keyof BotSettings> = {
      welcome: 'welcomeChannelId',
      introductions: 'introductionsChannelId',
      prompts: 'promptsChannelId',
      polls: 'pollsChannelId',
      sweats: 'sweatsChannelId',
      announcements: 'announcementsChannelId',
      freePicks: 'freePicksChannelId',
      premiumPicks: 'premiumPicksChannelId',
    };
    this.set(keyMap[type], channelId);
  },

  getTrackedChannels(): string[] {
    return this.getJson<string[]>('trackedChannels') || [];
  },

  addTrackedChannel(channelId: string): void {
    const channels = this.getTrackedChannels();
    if (!channels.includes(channelId)) {
      channels.push(channelId);
      this.setJson('trackedChannels', channels);
    }
  },

  removeTrackedChannel(channelId: string): void {
    const channels = this.getTrackedChannels().filter((id) => id !== channelId);
    this.setJson('trackedChannels', channels);
  },
};
