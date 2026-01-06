import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { activityRepo } from '../database/repositories/activity';
import { betsRepo } from '../database/repositories/bets';
import { ordinal } from '../utils/helpers';
import { Command } from './index';

export const statsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View activity and betting stats')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User to check (admins only)')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('range')
        .setDescription('Time range for betting stats')
        .setRequired(false)
        .addChoices(
          { name: 'Last 7 Days', value: '7d' },
          { name: 'Last 30 Days', value: '30d' },
          { name: 'All Time', value: 'all' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Type of stats to show')
        .setRequired(false)
        .addChoices(
          { name: 'Activity (messages)', value: 'activity' },
          { name: 'Betting Performance', value: 'betting' },
          { name: 'Both (default)', value: 'both' }
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const range = interaction.options.getString('range') || '30d';
    const type = interaction.options.getString('type') || 'both';

    // Only allow checking other users if admin
    if (targetUser.id !== interaction.user.id) {
      const member = await interaction.guild?.members.fetch(interaction.user.id);
      if (!member?.permissions.has('Administrator')) {
        await interaction.reply({
          content: '❌ You can only view your own stats.',
          ephemeral: true,
        });
        return;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📊 Stats for ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp();

    // Activity stats
    if (type === 'activity' || type === 'both') {
      const weeklyCount = activityRepo.getUserWeeklyCount(targetUser.id);
      const rank = activityRepo.getUserRank(targetUser.id);
      const totalCount = activityRepo.getUserTotalCount(targetUser.id);

      embed.addFields(
        {
          name: '💬 Activity',
          value: `This Week: **${weeklyCount}** messages\nRank: **${ordinal(rank)}** place\nAll Time: **${totalCount}** messages`,
          inline: type === 'both',
        }
      );
    }

    // Betting stats
    if (type === 'betting' || type === 'both') {
      const { startDate, endDate, rangeLabel } = calculateDateRange(range);

      // Get all bets in range (STAFF visibility = all)
      const allBets = betsRepo.getBetsInRange(startDate, endDate, 'STAFF');

      // Filter to bets created by this user (for betting stats)
      // Note: For server-wide stats, remove this filter
      const userBets = allBets.filter(b =>
        b.created_by === targetUser.id || !b.created_by // Include CSV imports if no creator
      );

      // Get settled bets only for stats
      const settledBets = userBets.filter(b =>
        b.result && ['WIN', 'LOSS', 'PUSH'].includes(b.result)
      );

      if (settledBets.length > 0) {
        const stats = betsRepo.calculateStats(settledBets);
        const pendingCount = userBets.filter(b => b.result === 'PENDING').length;

        const winRate = stats.wins + stats.losses > 0
          ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)
          : '0';

        const profitStr = stats.totalProfit >= 0
          ? `+${stats.totalProfit.toFixed(2)}u`
          : `${stats.totalProfit.toFixed(2)}u`;

        const roiStr = stats.roi >= 0
          ? `+${stats.roi.toFixed(1)}%`
          : `${stats.roi.toFixed(1)}%`;

        embed.addFields({
          name: `🎯 Betting (${rangeLabel})`,
          value: [
            `Record: **${stats.wins}W-${stats.losses}L-${stats.pushes}P**`,
            `Win Rate: **${winRate}%**`,
            `Units Risked: **${stats.totalStake.toFixed(2)}u**`,
            `Profit: **${profitStr}**`,
            `ROI: **${roiStr}**`,
            pendingCount > 0 ? `Pending: **${pendingCount}**` : '',
          ].filter(Boolean).join('\n'),
          inline: type === 'both',
        });

        // Add breakdown by sport if there's enough data
        if (settledBets.length >= 5) {
          const sportBreakdown = betsRepo.getBreakdownBySport(settledBets);
          const topSports = sportBreakdown.slice(0, 3);

          if (topSports.length > 0) {
            const breakdownLines = topSports.map(s => {
              const record = `${s.wins}W-${s.losses}L`;
              const profit = s.profit >= 0 ? `+${s.profit.toFixed(1)}u` : `${s.profit.toFixed(1)}u`;
              return `${s.category}: ${record} (${profit})`;
            });

            embed.addFields({
              name: '🏆 By Sport',
              value: breakdownLines.join('\n'),
              inline: false,
            });
          }
        }

        // Add breakdown by market
        if (settledBets.length >= 5) {
          const marketBreakdown = betsRepo.getBreakdownByMarket(settledBets);
          const topMarkets = marketBreakdown.slice(0, 3);

          if (topMarkets.length > 0) {
            const breakdownLines = topMarkets.map(m => {
              const record = `${m.wins}W-${m.losses}L`;
              const profit = m.profit >= 0 ? `+${m.profit.toFixed(1)}u` : `${m.profit.toFixed(1)}u`;
              return `${m.category}: ${record} (${profit})`;
            });

            embed.addFields({
              name: '🎰 By Market',
              value: breakdownLines.join('\n'),
              inline: false,
            });
          }
        }
      } else {
        embed.addFields({
          name: `🎯 Betting (${rangeLabel})`,
          value: 'No settled bets in this period',
          inline: type === 'both',
        });
      }
    }

    embed.setFooter({ text: 'Keep grinding! 💪' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

function calculateDateRange(range: string): {
  startDate: string;
  endDate: string;
  rangeLabel: string;
} {
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];

  let startDate: string;
  let rangeLabel: string;

  switch (range) {
    case '7d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      startDate = d.toISOString().split('T')[0];
      rangeLabel = 'Last 7 Days';
      break;
    }
    case '30d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      startDate = d.toISOString().split('T')[0];
      rangeLabel = 'Last 30 Days';
      break;
    }
    case 'all':
    default: {
      startDate = '2000-01-01';
      rangeLabel = 'All Time';
      break;
    }
  }

  return { startDate, endDate, rangeLabel };
}
