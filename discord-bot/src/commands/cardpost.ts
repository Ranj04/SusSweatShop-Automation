import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { betsRepo, BetVisibility, Bet } from '../database/repositories/bets';
import { settingsRepo } from '../database/repositories/settings';
import { logger } from '../utils/logger';
import { getDateString } from '../utils/helpers';
import { config } from '../config';
import { Command } from './index';

export const cardpostCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('cardpost')
    .setDescription('Post today\'s picks card to a channel')
    .addStringOption((opt) =>
      opt
        .setName('tier')
        .setDescription('Visibility tier to post')
        .setRequired(true)
        .addChoices(
          { name: 'Free Picks', value: 'FREE' },
          { name: 'Premium Picks', value: 'PREMIUM' }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('date')
        .setDescription('Date for picks (YYYY-MM-DD). Defaults to today.')
        .setRequired(false)
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Override channel to post to')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const tier = interaction.options.getString('tier', true) as 'FREE' | 'PREMIUM';
    const dateStr = interaction.options.getString('date') || getDateString();
    const channelOverride = interaction.options.getChannel('channel');

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      await interaction.reply({
        content: '❌ Invalid date format. Please use YYYY-MM-DD',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Get pending bets for the date
      const bets = betsRepo.getPendingBetsByDate(dateStr, tier);

      if (bets.length === 0) {
        await interaction.editReply({
          content: `📋 No ${tier} picks found for ${dateStr}`,
        });
        return;
      }

      // Determine channel
      let channel: TextChannel | undefined;

      if (channelOverride) {
        channel = channelOverride as TextChannel;
      } else {
        // Use configured channel based on tier
        const channelId = tier === 'FREE'
          ? settingsRepo.get('freePicksChannelId') || settingsRepo.getChannelId('announcements')
          : settingsRepo.get('premiumPicksChannelId') || settingsRepo.getChannelId('announcements');

        if (channelId) {
          const guild = interaction.guild;
          channel = guild?.channels.cache.get(channelId) as TextChannel;
        }
      }

      if (!channel) {
        await interaction.editReply({
          content: '❌ No channel configured. Use `/setchannel` or specify a channel.',
        });
        return;
      }

      // Build the card embed
      const embed = buildCardEmbed(bets, tier, dateStr);

      // Post to channel
      await channel.send({ embeds: [embed] });

      await interaction.editReply({
        content: `✅ Posted ${bets.length} ${tier} pick(s) for ${dateStr} to <#${channel.id}>`,
      });

      logger.info(`Card posted: ${bets.length} ${tier} picks for ${dateStr}`, {
        user: interaction.user.tag,
        channel: channel.id,
      });

    } catch (error) {
      logger.error('Error posting card', error);
      await interaction.editReply({
        content: '❌ Failed to post picks card',
      });
    }
  },
};

function buildCardEmbed(bets: Bet[], tier: 'FREE' | 'PREMIUM', dateStr: string): EmbedBuilder {
  const tierEmoji = tier === 'FREE' ? '🆓' : '💎';
  const tierColor = tier === 'FREE' ? 0x5865f2 : 0xffd700;

  // Group bets by sport
  const bySport = new Map<string, Bet[]>();
  for (const bet of bets) {
    const sport = bet.sport || 'Other';
    if (!bySport.has(sport)) {
      bySport.set(sport, []);
    }
    bySport.get(sport)!.push(bet);
  }

  // Calculate totals
  let totalUnits = 0;
  for (const bet of bets) {
    totalUnits += bet.stake || 0;
  }

  const embed = new EmbedBuilder()
    .setColor(tierColor)
    .setTitle(`${tierEmoji} ${tier === 'FREE' ? 'Free' : 'Premium'} Picks - ${dateStr}`)
    .setDescription(`**${bets.length} Play${bets.length > 1 ? 's' : ''} | ${totalUnits.toFixed(1)}u Total Risk**`);

  // Add each sport section
  for (const [sport, sportBets] of bySport) {
    const sportEmoji = getSportEmoji(sport);
    const betLines: string[] = [];

    for (const bet of sportBets) {
      const odds = bet.odds ?? 0;
      const oddsStr = odds > 0 ? `+${odds}` : `${odds}`;
      const line = `**${bet.pick}** @ ${oddsStr} (${bet.stake}u)`;
      betLines.push(line);

      // Add notes if present
      if (bet.notes) {
        betLines.push(`  └ _${bet.notes}_`);
      }
    }

    embed.addFields({
      name: `${sportEmoji} ${sport}`,
      value: betLines.join('\n') || 'No picks',
      inline: false,
    });
  }

  embed.setFooter({ text: 'BOL! 🍀 | SUSSWEATSHOP' });
  embed.setTimestamp();

  return embed;
}

function getSportEmoji(sport: string): string {
  const emojiMap: Record<string, string> = {
    'NBA': '🏀',
    'NFL': '🏈',
    'MLB': '⚾',
    'NHL': '🏒',
    'NCAAB': '🏀',
    'NCAAF': '🏈',
    'SOCCER': '⚽',
    'UFC': '🥊',
    'MMA': '🥊',
    'TENNIS': '🎾',
    'GOLF': '⛳',
  };
  return emojiMap[sport.toUpperCase()] || '🎯';
}
