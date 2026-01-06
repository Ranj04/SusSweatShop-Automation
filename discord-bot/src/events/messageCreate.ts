import { Client, Events, Message, TextChannel } from 'discord.js';
import { logger } from '../utils/logger';
import { settingsRepo } from '../database/repositories/settings';
import { activityRepo } from '../database/repositories/activity';
import { introductionsRepo } from '../database/repositories/introductions';

export function registerMessageCreateEvent(client: Client): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    // Ignore bots
    if (message.author.bot) return;

    // Ignore DMs
    if (!message.guild) return;

    // Track activity in configured channels
    await trackActivity(message);

    // Handle introduction posts
    await handleIntroduction(message);
  });
}

async function trackActivity(message: Message): Promise<void> {
  const trackedChannels = settingsRepo.getTrackedChannels();
  const sweatsChannelId = settingsRepo.getChannelId('sweats');

  // Always track sweats channel
  if (sweatsChannelId) {
    trackedChannels.push(sweatsChannelId);
  }

  // Check if message is in a tracked channel or thread
  const channelId = message.channel.isThread()
    ? message.channel.parentId || message.channel.id
    : message.channel.id;

  if (!trackedChannels.includes(channelId)) return;

  try {
    activityRepo.trackMessage(message.author.id, channelId);
  } catch (error) {
    logger.error('Error tracking activity', error);
  }
}

async function handleIntroduction(message: Message): Promise<void> {
  const introChannelId = settingsRepo.getChannelId('introductions');
  if (!introChannelId) return;

  // Check if message is in introductions channel
  if (message.channel.id !== introChannelId) return;

  // Check if user has already introduced themselves
  if (introductionsRepo.hasIntroduced(message.author.id)) return;

  // Message too short? Probably not a real intro
  if (message.content.length < 20) return;

  try {
    // Mark as introduced
    introductionsRepo.markIntroduced(message.author.id);

    // React with checkmark
    await message.react('✅');

    // Assign Member role if configured
    const memberRoleId = settingsRepo.get('memberRoleId');
    if (memberRoleId && message.member) {
      const role = message.guild?.roles.cache.get(memberRoleId);
      if (role) {
        await message.member.roles.add(role);
        logger.info(`Assigned Member role to ${message.author.tag}`);
      }
    }

    logger.info(`New introduction from ${message.author.tag}`);
  } catch (error) {
    logger.error('Error handling introduction', error);
  }
}
