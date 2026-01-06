import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { betsRepo, BetVisibility } from '../database/repositories/bets';
import { logger } from '../utils/logger';
import { Command } from './index';

const SPORTS = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'SOCCER', 'UFC', 'OTHER'] as const;
const MARKETS = ['ML', 'PROP', 'SPREAD', 'TOTAL', 'PARLAY', 'LIVE', 'OTHER'] as const;

export const logbetCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('logbet')
    .setDescription('Log a new bet for tracking')
    .addStringOption((opt) =>
      opt
        .setName('sport')
        .setDescription('Sport league')
        .setRequired(true)
        .addChoices(
          ...SPORTS.map((s) => ({ name: s, value: s }))
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('market')
        .setDescription('Bet type')
        .setRequired(true)
        .addChoices(
          { name: 'Moneyline (ML)', value: 'ML' },
          { name: 'Player Prop', value: 'PROP' },
          { name: 'Spread', value: 'SPREAD' },
          { name: 'Total (O/U)', value: 'TOTAL' },
          { name: 'Parlay', value: 'PARLAY' },
          { name: 'Live Bet', value: 'LIVE' },
          { name: 'Other', value: 'OTHER' }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('pick')
        .setDescription('Your pick (e.g., "Lakers ML" or "Steph Curry O 4.5 3PM")')
        .setRequired(true)
        .setMaxLength(200)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('odds')
        .setDescription('American odds (e.g., -110, +135)')
        .setRequired(true)
        .setMinValue(-10000)
        .setMaxValue(10000)
    )
    .addNumberOption((opt) =>
      opt
        .setName('units')
        .setDescription('Units risked (e.g., 1, 1.5, 2)')
        .setRequired(true)
        .setMinValue(0.1)
        .setMaxValue(100)
    )
    .addStringOption((opt) =>
      opt
        .setName('visibility')
        .setDescription('Who can see this bet')
        .setRequired(false)
        .addChoices(
          { name: 'Staff Only (default)', value: 'STAFF' },
          { name: 'Premium Members', value: 'PREMIUM' },
          { name: 'Free (Public)', value: 'FREE' }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('book')
        .setDescription('Sportsbook (e.g., DraftKings, FanDuel)')
        .setRequired(false)
        .setMaxLength(50)
    )
    .addStringOption((opt) =>
      opt
        .setName('game_date')
        .setDescription('Game date (YYYY-MM-DD)')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('notes')
        .setDescription('Additional notes')
        .setRequired(false)
        .setMaxLength(500)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sport = interaction.options.getString('sport', true);
    const market = interaction.options.getString('market', true);
    const pick = interaction.options.getString('pick', true);
    const odds = interaction.options.getInteger('odds', true);
    const units = interaction.options.getNumber('units', true);
    const visibility = (interaction.options.getString('visibility') || 'STAFF') as BetVisibility;
    const book = interaction.options.getString('book');
    const gameDate = interaction.options.getString('game_date');
    const notes = interaction.options.getString('notes');

    // Validate game_date format if provided
    if (gameDate && !/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
      await interaction.reply({
        content: '❌ Invalid date format. Please use YYYY-MM-DD (e.g., 2024-01-15)',
        ephemeral: true,
      });
      return;
    }

    try {
      const betId = betsRepo.logBet({
        sport,
        market,
        pick,
        odds,
        stake: units,
        visibility,
        book: book || undefined,
        gameDate: gameDate || undefined,
        notes: notes || undefined,
        createdBy: interaction.user.id,
      });

      // Format odds display
      const oddsDisplay = odds > 0 ? `+${odds}` : odds.toString();

      // Calculate potential profit
      let potentialProfit: number;
      if (odds < 0) {
        potentialProfit = units * (100 / Math.abs(odds));
      } else {
        potentialProfit = units * (odds / 100);
      }
      potentialProfit = Math.round(potentialProfit * 100) / 100;

      const visibilityEmoji = visibility === 'FREE' ? '🆓' : visibility === 'PREMIUM' ? '💎' : '🔒';

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Bet Logged')
        .addFields(
          { name: 'ID', value: `#${betId}`, inline: true },
          { name: 'Sport', value: sport, inline: true },
          { name: 'Market', value: market, inline: true },
          { name: 'Pick', value: pick, inline: false },
          { name: 'Odds', value: oddsDisplay, inline: true },
          { name: 'Units', value: `${units}u`, inline: true },
          { name: 'To Win', value: `${potentialProfit.toFixed(2)}u`, inline: true },
          { name: 'Visibility', value: `${visibilityEmoji} ${visibility}`, inline: true }
        );

      if (book) {
        embed.addFields({ name: 'Book', value: book, inline: true });
      }

      if (gameDate) {
        embed.addFields({ name: 'Game Date', value: gameDate, inline: true });
      }

      if (notes) {
        embed.addFields({ name: 'Notes', value: notes, inline: false });
      }

      embed.setFooter({ text: `Logged by ${interaction.user.username}` });
      embed.setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

      logger.info(`Bet logged: #${betId} ${sport} ${market} ${pick} @ ${oddsDisplay}`, {
        user: interaction.user.tag,
        betId,
      });

    } catch (error) {
      logger.error('Error logging bet', error);
      await interaction.reply({
        content: '❌ Failed to log bet. Please try again.',
        ephemeral: true,
      });
    }
  },
};
