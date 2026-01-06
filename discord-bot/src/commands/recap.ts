import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { betsRepo, BetVisibility } from '../database/repositories/bets';
import { logger } from '../utils/logger';
import { getDateString } from '../utils/helpers';
import { Command } from './index';

export const recapCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('recap')
    .setDescription('Generate a betting performance recap')
    .addStringOption((opt) =>
      opt
        .setName('tier')
        .setDescription('Visibility tier to include')
        .setRequired(true)
        .addChoices(
          { name: 'Free (public bets only)', value: 'FREE' },
          { name: 'Premium (Free + Premium)', value: 'PREMIUM' },
          { name: 'Staff (all bets)', value: 'STAFF' }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('date')
        .setDescription('Date for recap (YYYY-MM-DD). Defaults to today.')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('range')
        .setDescription('Date range for recap')
        .setRequired(false)
        .addChoices(
          { name: 'Single Day', value: 'day' },
          { name: 'Last 7 Days', value: 'week' },
          { name: 'Last 30 Days', value: 'month' },
          { name: 'All Time', value: 'all' }
        )
    )
    .addBooleanOption((opt) =>
      opt
        .setName('public')
        .setDescription('Post recap publicly (default: ephemeral)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const tier = interaction.options.getString('tier', true) as BetVisibility;
    const dateStr = interaction.options.getString('date');
    const range = interaction.options.getString('range') || 'day';
    const isPublic = interaction.options.getBoolean('public') || false;

    await interaction.deferReply({ ephemeral: !isPublic });

    try {
      // Calculate date range
      const { startDate, endDate, rangeLabel } = calculateDateRange(dateStr, range);

      // Get bets for the range
      const bets = betsRepo.getSettledBets(startDate, endDate, tier);

      if (bets.length === 0) {
        await interaction.editReply({
          content: `📊 No settled bets found for ${rangeLabel} (${tier} tier)`,
        });
        return;
      }

      // Calculate stats
      const stats = betsRepo.calculateStats(bets);
      const sportBreakdown = betsRepo.getBreakdownBySport(bets);
      const marketBreakdown = betsRepo.getBreakdownByMarket(bets);

      // Build embed
      const embed = buildRecapEmbed(tier, rangeLabel, stats, sportBreakdown, marketBreakdown, bets.length);

      await interaction.editReply({ embeds: [embed] });

      logger.info(`Recap generated: ${tier} tier, ${rangeLabel}`, { user: interaction.user.tag });

    } catch (error) {
      logger.error('Error generating recap', error);
      await interaction.editReply({
        content: '❌ Failed to generate recap',
      });
    }
  },
};

function calculateDateRange(
  dateStr: string | null,
  range: string
): { startDate: string; endDate: string; rangeLabel: string } {
  const baseDate = dateStr || getDateString();
  const endDate = baseDate;

  let startDate: string;
  let rangeLabel: string;

  switch (range) {
    case 'week': {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - 6);
      startDate = d.toISOString().split('T')[0];
      rangeLabel = `Last 7 Days (${startDate} to ${endDate})`;
      break;
    }
    case 'month': {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - 29);
      startDate = d.toISOString().split('T')[0];
      rangeLabel = `Last 30 Days (${startDate} to ${endDate})`;
      break;
    }
    case 'all': {
      startDate = '2000-01-01';
      rangeLabel = 'All Time';
      break;
    }
    default: {
      startDate = baseDate;
      rangeLabel = baseDate;
      break;
    }
  }

  return { startDate, endDate, rangeLabel };
}

export function buildRecapEmbed(
  tier: BetVisibility,
  rangeLabel: string,
  stats: ReturnType<typeof betsRepo.calculateStats>,
  sportBreakdown: ReturnType<typeof betsRepo.getBreakdownBySport>,
  marketBreakdown: ReturnType<typeof betsRepo.getBreakdownByMarket>,
  totalBets: number
): EmbedBuilder {
  const tierEmoji = tier === 'FREE' ? '🆓' : tier === 'PREMIUM' ? '💎' : '👑';
  const profitEmoji = stats.totalProfit >= 0 ? '📈' : '📉';
  const roiColor = stats.roi >= 0 ? 0x00ff00 : 0xff0000;

  const embed = new EmbedBuilder()
    .setColor(roiColor)
    .setTitle(`${tierEmoji} Betting Recap - ${tier}`)
    .setDescription(`**${rangeLabel}**`)
    .addFields(
      {
        name: '📊 Record',
        value: `**${stats.wins}W - ${stats.losses}L - ${stats.pushes}P**`,
        inline: true,
      },
      {
        name: '💰 Units Risked',
        value: `${stats.totalStake.toFixed(2)}u`,
        inline: true,
      },
      {
        name: `${profitEmoji} Profit`,
        value: `${stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit.toFixed(2)}u`,
        inline: true,
      },
      {
        name: '📈 ROI',
        value: `${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%`,
        inline: true,
      },
      {
        name: '🎯 Win Rate',
        value: `${((stats.wins / (stats.wins + stats.losses)) * 100 || 0).toFixed(1)}%`,
        inline: true,
      },
      {
        name: '📝 Total Bets',
        value: `${totalBets}`,
        inline: true,
      }
    );

  // Sport breakdown
  if (sportBreakdown.length > 0) {
    const sportLines = sportBreakdown.slice(0, 5).map((s) => {
      const record = `${s.wins}W-${s.losses}L`;
      const profit = s.profit >= 0 ? `+${s.profit.toFixed(1)}u` : `${s.profit.toFixed(1)}u`;
      return `**${s.category}**: ${record} (${profit})`;
    });
    embed.addFields({
      name: '🏆 By Sport',
      value: sportLines.join('\n') || 'N/A',
      inline: false,
    });
  }

  // Market breakdown
  if (marketBreakdown.length > 0) {
    const marketLines = marketBreakdown.slice(0, 5).map((m) => {
      const record = `${m.wins}W-${m.losses}L`;
      const profit = m.profit >= 0 ? `+${m.profit.toFixed(1)}u` : `${m.profit.toFixed(1)}u`;
      return `**${m.category}**: ${record} (${profit})`;
    });
    embed.addFields({
      name: '🎰 By Market',
      value: marketLines.join('\n') || 'N/A',
      inline: false,
    });
  }

  embed.setFooter({ text: 'SUSSWEATSHOP' });
  embed.setTimestamp();

  return embed;
}
