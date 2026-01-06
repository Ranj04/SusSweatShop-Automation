import { Client, TextChannel } from 'discord.js';
import { settingsRepo } from '../database/repositories/settings';
import { promptsRepo } from '../database/repositories/prompts';
import { logger } from '../utils/logger';
import { getTodaySport, replaceVariables } from '../utils/helpers';
import { config } from '../config';

export async function postDailyPrompt(client: Client): Promise<boolean> {
  try {
    // Get prompts channel
    const channelId = settingsRepo.getChannelId('prompts');
    if (!channelId) {
      logger.warn('Prompts channel not configured');
      return false;
    }

    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) {
      logger.error('Guild not found');
      return false;
    }

    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (!channel) {
      logger.error(`Prompts channel ${channelId} not found`);
      return false;
    }

    // Get random prompt
    const prompt = promptsRepo.getRandom();
    if (!prompt) {
      logger.warn('No prompts available in database');
      return false;
    }

    // Replace variables
    const sport = getTodaySport();
    const text = replaceVariables(prompt.text, { sport });

    // Post the prompt
    await channel.send({
      content: `💬 **Daily Discussion**\n\n${text}`,
    });

    logger.info(`Posted daily prompt: "${text}"`);
    return true;
  } catch (error) {
    logger.error('Error posting daily prompt', error);
    return false;
  }
}
