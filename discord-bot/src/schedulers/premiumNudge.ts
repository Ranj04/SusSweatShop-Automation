import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { settingsRepo } from '../database/repositories/settings';
import { premiumNudgesRepo } from '../database/repositories/premiumNudges';
import { logger } from '../utils/logger';
import { config } from '../config';

export async function postPremiumNudge(client: Client): Promise<boolean> {
  try {
    // Check if we can post (7+ days since last)
    if (!premiumNudgesRepo.canPostNudge()) {
      logger.info('Premium nudge skipped - posted within last 7 days');
      return false;
    }

    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) {
      logger.error('Guild not found');
      return false;
    }

    // Get announcements channel
    const channelId = settingsRepo.getChannelId('announcements');
    if (!channelId) {
      logger.warn('Announcements channel not configured for premium nudge');
      return false;
    }

    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (!channel) {
      logger.error(`Announcements channel ${channelId} not found`);
      return false;
    }

    // Build the premium info embed
    const embed = new EmbedBuilder()
      .setColor(0xffd700) // Gold
      .setTitle('💎 SUSSWEATSHOP Premium')
      .setDescription('Take your betting to the next level with Premium access!')
      .addFields(
        {
          name: '🎯 What You Get',
          value: [
            '• **VIP Picks Channel** - Exclusive high-confidence plays',
            '• **Early Access** - Get picks before they hit the free channel',
            '• **Detailed Analysis** - Full breakdowns on every play',
            '• **Private Discord Access** - Direct access to our best cappers',
            '• **Live Alerts** - Real-time notifications for plays',
            '• **Premium Role** - Stand out in the community',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📊 Track Record',
          value: 'Join hundreds of members already profiting with Premium picks!',
          inline: false,
        },
        {
          name: '🔗 Join Now',
          value: `[Click here to subscribe](${config.whop.link})`,
          inline: false,
        }
      )
      .setFooter({ text: 'Cancel anytime • Instant access' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    // Record the nudge
    premiumNudgesRepo.recordNudge();
    premiumNudgesRepo.cleanup();

    logger.info('Posted premium nudge');
    return true;
  } catch (error) {
    logger.error('Error posting premium nudge', error);
    return false;
  }
}
