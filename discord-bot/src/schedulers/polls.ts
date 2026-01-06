import { Client, TextChannel, PollLayoutType } from 'discord.js';
import { settingsRepo } from '../database/repositories/settings';
import { pollsRepo } from '../database/repositories/polls';
import { logger } from '../utils/logger';
import { config } from '../config';

const POLL_EMOJIS = ['🅰️', '🅱️', '🅾️', '🆎'];

export async function postDailyPoll(client: Client): Promise<boolean> {
  try {
    // Get polls channel
    const channelId = settingsRepo.getChannelId('polls');
    if (!channelId) {
      logger.warn('Polls channel not configured');
      return false;
    }

    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) {
      logger.error('Guild not found');
      return false;
    }

    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (!channel) {
      logger.error(`Polls channel ${channelId} not found`);
      return false;
    }

    // Get random poll
    const poll = pollsRepo.getRandom();
    if (!poll) {
      logger.warn('No polls available in database');
      return false;
    }

    // Try to use Discord's native poll feature (discord.js v14.15+)
    try {
      await channel.send({
        poll: {
          question: { text: poll.question },
          answers: poll.options.map((option) => ({ text: option })),
          duration: 24, // hours
          allowMultiselect: false,
          layoutType: PollLayoutType.Default,
        },
      });

      logger.info(`Posted native poll: "${poll.question}"`);
      return true;
    } catch (pollError) {
      // Fall back to reaction-based poll if native polls not supported
      logger.warn('Native polls not available, using reaction-based poll');
      return await postReactionPoll(channel, poll.question, poll.options);
    }
  } catch (error) {
    logger.error('Error posting daily poll', error);
    return false;
  }
}

async function postReactionPoll(
  channel: TextChannel,
  question: string,
  options: string[]
): Promise<boolean> {
  try {
    const optionLines = options.map((opt, i) => `${POLL_EMOJIS[i]} ${opt}`).join('\n');

    const message = await channel.send({
      content: `📊 **Poll Time!**\n\n**${question}**\n\n${optionLines}\n\n*React to vote!*`,
    });

    // Add reaction options
    for (let i = 0; i < options.length; i++) {
      await message.react(POLL_EMOJIS[i]);
    }

    logger.info(`Posted reaction poll: "${question}"`);
    return true;
  } catch (error) {
    logger.error('Error posting reaction poll', error);
    return false;
  }
}
