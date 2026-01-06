import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { betsRepo } from '../database/repositories/bets';
import { getDateString } from '../utils/helpers';
import { Command } from './index';

export const listbetsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('listbets')
    .setDescription('List bets for a specific date')
    .addStringOption((opt) =>
      opt
        .setName('date')
        .setDescription('Date to list (YYYY-MM-DD). Defaults to today.')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const dateStr = interaction.options.getString('date') || getDateString();

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      await interaction.reply({
        content: '❌ Invalid date format. Please use YYYY-MM-DD',
        ephemeral: true,
      });
      return;
    }

    const bets = betsRepo.getBetsByDate(dateStr);

    if (bets.length === 0) {
      await interaction.reply({
        content: `📋 No bets found for ${dateStr}`,
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📋 Bets for ${dateStr}`)
      .setDescription(`Found ${bets.length} bet(s)`);

    const betLines: string[] = [];

    for (const bet of bets.slice(0, 15)) {
      const pick = bet.pick
        ? (bet.pick.length > 35 ? bet.pick.slice(0, 35) + '...' : bet.pick)
        : 'N/A';
      const result = bet.result || 'PENDING';
      const visibility = bet.visibility;
      const resultEmoji = result === 'WIN' ? '✅' : result === 'LOSS' ? '❌' : result === 'PUSH' ? '➖' : '⏳';

      betLines.push(
        `**#${bet.id}** ${resultEmoji} ${pick}\n` +
        `└ ${bet.odds || 'N/A'} | ${bet.stake || '?'}u | ${visibility}`
      );
    }

    if (bets.length > 15) {
      betLines.push(`\n... and ${bets.length - 15} more`);
    }

    embed.addFields({
      name: 'Bets',
      value: betLines.join('\n\n') || 'None',
    });

    embed.setFooter({ text: 'Use /tagbet or /tagbetsbulk to update visibility' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
