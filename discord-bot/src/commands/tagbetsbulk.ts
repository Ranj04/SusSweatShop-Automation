import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { betsRepo, BetVisibility } from '../database/repositories/bets';
import { logger } from '../utils/logger';
import { Command } from './index';

export const tagbetsbulkCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('tagbetsbulk')
    .setDescription('Update visibility of all bets for a specific date')
    .addStringOption((opt) =>
      opt
        .setName('date')
        .setDescription('Date to update (YYYY-MM-DD)')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('visibility')
        .setDescription('New visibility level')
        .setRequired(true)
        .addChoices(
          { name: 'Free (public)', value: 'FREE' },
          { name: 'Premium', value: 'PREMIUM' },
          { name: 'Staff (private)', value: 'STAFF' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const dateStr = interaction.options.getString('date', true);
    const visibility = interaction.options.getString('visibility', true) as BetVisibility;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      await interaction.reply({
        content: '❌ Invalid date format. Please use YYYY-MM-DD (e.g., 2024-01-15)',
        ephemeral: true,
      });
      return;
    }

    // Validate date is real
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      await interaction.reply({
        content: '❌ Invalid date. Please use a valid date in YYYY-MM-DD format.',
        ephemeral: true,
      });
      return;
    }

    try {
      // Get bets for this date to show in preview
      const betsOnDate = betsRepo.getBetsByDate(dateStr);

      if (betsOnDate.length === 0) {
        await interaction.reply({
          content: `❌ No bets found for ${dateStr}`,
          ephemeral: true,
        });
        return;
      }

      // Update all bets for this date
      const updatedCount = betsRepo.bulkUpdateVisibilityByDate(dateStr, visibility);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Bulk Update Complete')
        .addFields(
          { name: 'Date', value: dateStr, inline: true },
          { name: 'New Visibility', value: visibility, inline: true },
          { name: 'Bets Updated', value: `${updatedCount}`, inline: true }
        );

      // Show sample of updated bets
      if (betsOnDate.length > 0) {
        const sampleBets = betsOnDate.slice(0, 5).map((b) => {
          const pick = b.pick ? (b.pick.length > 40 ? b.pick.slice(0, 40) + '...' : b.pick) : 'N/A';
          return `#${b.id}: ${pick}`;
        });

        let betList = sampleBets.join('\n');
        if (betsOnDate.length > 5) {
          betList += `\n... and ${betsOnDate.length - 5} more`;
        }

        embed.addFields({
          name: 'Updated Bets',
          value: betList,
          inline: false,
        });
      }

      embed.setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

      logger.info(`Bulk visibility update: ${updatedCount} bets on ${dateStr} -> ${visibility}`, {
        user: interaction.user.tag,
      });

    } catch (error) {
      logger.error('Error in bulk bet update', error);
      await interaction.reply({
        content: '❌ An error occurred during the bulk update',
        ephemeral: true,
      });
    }
  },
};
