import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { betsRepo, BetVisibility } from '../database/repositories/bets';
import { logger } from '../utils/logger';
import { Command } from './index';

export const tagbetCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('tagbet')
    .setDescription('Update visibility of a single bet')
    .addIntegerOption((opt) =>
      opt
        .setName('bet_id')
        .setDescription('The bet ID to update')
        .setRequired(true)
        .setMinValue(1)
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
    const betId = interaction.options.getInteger('bet_id', true);
    const visibility = interaction.options.getString('visibility', true) as BetVisibility;

    try {
      // Get the bet first
      const bet = betsRepo.getById(betId);

      if (!bet) {
        await interaction.reply({
          content: `❌ Bet #${betId} not found`,
          ephemeral: true,
        });
        return;
      }

      // Update visibility
      const updated = betsRepo.updateVisibility(betId, visibility);

      if (updated) {
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('✅ Bet Updated')
          .addFields(
            { name: 'Bet ID', value: `#${betId}`, inline: true },
            { name: 'Pick', value: bet.pick || 'N/A', inline: true },
            { name: 'Old Visibility', value: bet.visibility, inline: true },
            { name: 'New Visibility', value: visibility, inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

        logger.info(`Bet #${betId} visibility updated: ${bet.visibility} -> ${visibility}`, {
          user: interaction.user.tag,
        });
      } else {
        await interaction.reply({
          content: `❌ Failed to update bet #${betId}`,
          ephemeral: true,
        });
      }
    } catch (error) {
      logger.error('Error updating bet visibility', error);
      await interaction.reply({
        content: '❌ An error occurred while updating the bet',
        ephemeral: true,
      });
    }
  },
};
