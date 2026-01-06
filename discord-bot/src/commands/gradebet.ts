import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { betsRepo, BetResult } from '../database/repositories/bets';
import { logger } from '../utils/logger';
import { Command } from './index';

export const gradebetCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('gradebet')
    .setDescription('Grade a bet result')
    .addIntegerOption((opt) =>
      opt
        .setName('bet_id')
        .setDescription('The bet ID to grade')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((opt) =>
      opt
        .setName('result')
        .setDescription('Bet result')
        .setRequired(true)
        .addChoices(
          { name: '✅ Win', value: 'WIN' },
          { name: '❌ Loss', value: 'LOSS' },
          { name: '➖ Push', value: 'PUSH' },
          { name: '🚫 Void', value: 'VOID' }
        )
    )
    .addIntegerOption((opt) =>
      opt
        .setName('settled_odds')
        .setDescription('Final odds if different from original (e.g., for line moves)')
        .setRequired(false)
        .setMinValue(-10000)
        .setMaxValue(10000)
    )
    .addStringOption((opt) =>
      opt
        .setName('settled_at')
        .setDescription('Settlement date (YYYY-MM-DD). Defaults to today.')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const betId = interaction.options.getInteger('bet_id', true);
    const result = interaction.options.getString('result', true) as BetResult;
    const settledOdds = interaction.options.getInteger('settled_odds') ?? undefined;
    const settledAt = interaction.options.getString('settled_at') ?? undefined;

    // Validate settled_at format if provided
    if (settledAt && !/^\d{4}-\d{2}-\d{2}$/.test(settledAt)) {
      await interaction.reply({
        content: '❌ Invalid date format. Please use YYYY-MM-DD',
        ephemeral: true,
      });
      return;
    }

    // Get the bet first
    const bet = betsRepo.getById(betId);

    if (!bet) {
      await interaction.reply({
        content: `❌ Bet #${betId} not found`,
        ephemeral: true,
      });
      return;
    }

    if (bet.result !== 'PENDING') {
      await interaction.reply({
        content: `⚠️ Bet #${betId} is already graded as **${bet.result}**. Use /tagbet to modify.`,
        ephemeral: true,
      });
      return;
    }

    try {
      const { success, profit } = betsRepo.gradeBet(betId, result, settledOdds, settledAt);

      if (!success) {
        await interaction.reply({
          content: '❌ Failed to grade bet',
          ephemeral: true,
        });
        return;
      }

      // Format display
      const resultEmoji = result === 'WIN' ? '✅' : result === 'LOSS' ? '❌' : result === 'PUSH' ? '➖' : '🚫';
      const profitStr = profit >= 0 ? `+${profit.toFixed(2)}u` : `${profit.toFixed(2)}u`;
      const profitColor = profit > 0 ? 0x00ff00 : profit < 0 ? 0xff0000 : 0xffaa00;

      const oddsDisplay = (settledOdds ?? bet.odds ?? 0) > 0
        ? `+${settledOdds ?? bet.odds}`
        : `${settledOdds ?? bet.odds}`;

      const embed = new EmbedBuilder()
        .setColor(profitColor)
        .setTitle(`${resultEmoji} Bet #${betId} Graded: ${result}`)
        .addFields(
          { name: 'Pick', value: bet.pick || 'N/A', inline: false },
          { name: 'Sport', value: bet.sport || 'N/A', inline: true },
          { name: 'Market', value: bet.market || 'N/A', inline: true },
          { name: 'Odds', value: oddsDisplay, inline: true },
          { name: 'Stake', value: `${bet.stake}u`, inline: true },
          { name: 'P/L', value: profitStr, inline: true },
          { name: 'Visibility', value: bet.visibility, inline: true }
        )
        .setFooter({ text: `Graded by ${interaction.user.username}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

      logger.info(`Bet graded: #${betId} ${result} (${profitStr})`, {
        user: interaction.user.tag,
        betId,
        result,
        profit,
      });

    } catch (error) {
      logger.error('Error grading bet', error);
      await interaction.reply({
        content: '❌ An error occurred while grading the bet',
        ephemeral: true,
      });
    }
  },
};
