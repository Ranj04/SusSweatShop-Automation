import { Client, TextChannel, EmbedBuilder, Role } from 'discord.js';
import { settingsRepo } from '../database/repositories/settings';
import { activityRepo } from '../database/repositories/activity';
import { logger } from '../utils/logger';
import { ordinal, getWeekNumber } from '../utils/helpers';
import { config } from '../config';

export async function postWeeklyLeaderboard(client: Client): Promise<boolean> {
  try {
    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) {
      logger.error('Guild not found');
      return false;
    }

    // Get last week's leaderboard
    const leaderboard = activityRepo.getLastWeekLeaderboard(10);

    if (leaderboard.length === 0) {
      logger.info('No activity data for last week');
      return false;
    }

    // Build leaderboard embed
    const embed = new EmbedBuilder()
      .setColor(0xffd700) // Gold
      .setTitle('🏆 Weekly Activity Leaderboard')
      .setDescription('Top contributors from last week!')
      .setTimestamp();

    const leaderboardLines: string[] = [];
    for (const entry of leaderboard) {
      const member = await guild.members.fetch(entry.user_id).catch(() => null);
      const name = member?.displayName || `User ${entry.user_id.slice(-4)}`;

      let medal = '';
      if (entry.rank === 1) medal = '🥇';
      else if (entry.rank === 2) medal = '🥈';
      else if (entry.rank === 3) medal = '🥉';
      else medal = `${entry.rank}.`;

      leaderboardLines.push(`${medal} **${name}** - ${entry.total_messages} messages`);
    }

    embed.addFields({
      name: 'Rankings',
      value: leaderboardLines.join('\n'),
    });

    // Handle Top Contributor role
    const topContributorRoleId = settingsRepo.get('topContributorRoleId');
    if (topContributorRoleId && leaderboard.length > 0) {
      const role = guild.roles.cache.get(topContributorRoleId);
      if (role) {
        // Remove role from all current holders
        const membersWithRole = role.members;
        for (const [, member] of membersWithRole) {
          await member.roles.remove(role).catch(() => null);
        }

        // Assign to new winner
        const winnerId = leaderboard[0].user_id;
        const winner = await guild.members.fetch(winnerId).catch(() => null);
        if (winner) {
          await winner.roles.add(role).catch(() => null);
          embed.addFields({
            name: '👑 Top Contributor',
            value: `Congrats to <@${winnerId}> for earning the ${role.name} role!`,
          });
          logger.info(`Assigned Top Contributor role to ${winner.user.tag}`);
        }
      }
    }

    // Post to announcements or prompts channel
    const channelId = settingsRepo.getChannelId('announcements') || settingsRepo.getChannelId('prompts');
    if (!channelId) {
      logger.warn('No channel configured for leaderboard');
      return false;
    }

    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (!channel) {
      logger.error(`Channel ${channelId} not found`);
      return false;
    }

    await channel.send({ embeds: [embed] });

    // Cleanup old activity data
    const deleted = activityRepo.cleanup();
    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} old activity records`);
    }

    logger.info('Posted weekly leaderboard');
    return true;
  } catch (error) {
    logger.error('Error posting weekly leaderboard', error);
    return false;
  }
}
