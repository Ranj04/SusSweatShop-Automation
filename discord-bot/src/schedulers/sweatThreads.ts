import { Client, TextChannel, ChannelType } from 'discord.js';
import { settingsRepo } from '../database/repositories/settings';
import { logger } from '../utils/logger';
import { getDateString, getTodaySport } from '../utils/helpers';
import { config } from '../config';

export async function createSweatThread(client: Client): Promise<boolean> {
  try {
    // Get sweats channel
    const channelId = settingsRepo.getChannelId('sweats');
    if (!channelId) {
      logger.warn('Sweats channel not configured');
      return false;
    }

    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) {
      logger.error('Guild not found');
      return false;
    }

    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (!channel) {
      logger.error(`Sweats channel ${channelId} not found`);
      return false;
    }

    // Create thread name with date
    const dateStr = getDateString();
    const sport = getTodaySport();
    const threadName = `Sweat Thread - ${dateStr}`;

    // Check if thread already exists today
    const existingThread = channel.threads.cache.find(
      (t) => t.name === threadName && !t.archived
    );

    if (existingThread) {
      logger.info(`Sweat thread already exists: ${threadName}`);
      return true;
    }

    // Create the thread
    const thread = await channel.threads.create({
      name: threadName,
      autoArchiveDuration: 1440, // 24 hours
      reason: 'Daily sweat thread',
    });

    // Post initial message
    await thread.send({
      content: `🔥 **${threadName}**\n\n` +
        `Tonight's focus: **${sport}**\n\n` +
        `Drop your plays + live reactions here!\n\n` +
        `• Share your bets\n` +
        `• Post live updates\n` +
        `• Celebrate wins (and mourn losses)\n` +
        `• Keep the energy up!\n\n` +
        `Let's get this bread! 🍞`,
    });

    logger.info(`Created sweat thread: ${threadName}`);
    return true;
  } catch (error) {
    logger.error('Error creating sweat thread', error);
    return false;
  }
}
