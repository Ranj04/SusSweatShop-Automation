import { Client, TextChannel } from 'discord.js';
import { settingsRepo } from '../database/repositories/settings';
import { betsRepo, BetVisibility } from '../database/repositories/bets';
import { logger } from '../utils/logger';
import { config } from '../config';
import { buildRecapEmbed } from '../commands/recap';
import { generateRecapSummary, generateBigWinMessage } from '../services/gemini';

/**
 * Post automated daily recap for the previous day's settled bets
 */
export async function postDailyRecap(client: Client): Promise<boolean> {
  try {
    // Get recaps channel
    const channelId = settingsRepo.getChannelId('announcements');
    if (!channelId) {
      logger.warn('No announcements channel configured for daily recap');
      return false;
    }

    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) {
      logger.error('Guild not found');
      return false;
    }

    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (!channel) {
      logger.error(`Announcements channel ${channelId} not found`);
      return false;
    }

    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    // Check if already posted for this date
    if (betsRepo.hasPostedRecapForDate(dateStr)) {
      logger.info(`Daily recap already posted for ${dateStr}`);
      return false;
    }

    // Get settled bets for yesterday (FREE tier for public recap)
    const visibility: BetVisibility = 'FREE';
    const bets = betsRepo.getSettledByDate(dateStr, visibility);

    if (bets.length === 0) {
      logger.info(`No settled bets for ${dateStr}, skipping daily recap`);
      return false;
    }

    // Calculate stats
    const stats = betsRepo.calculateStats(bets);
    const sportBreakdown = betsRepo.getBreakdownBySport(bets);
    const marketBreakdown = betsRepo.getBreakdownByMarket(bets);

    // Build recap embed
    const embed = buildRecapEmbed(
      visibility,
      dateStr,
      stats,
      sportBreakdown,
      marketBreakdown,
      bets.length
    );

    // Generate AI summary message
    let aiSummary: string;
    const isBigWin = stats.totalProfit >= 5; // 5+ units is a big win

    if (isBigWin) {
      const record = `${stats.wins}-${stats.losses}`;
      aiSummary = await generateBigWinMessage(stats.totalProfit, record);
    } else {
      aiSummary = await generateRecapSummary({
        date: dateStr,
        stats,
        sportBreakdown,
        marketBreakdown,
        totalBets: bets.length,
      });
    }

    // Build the full message with emoji indicator and AI summary
    const resultEmoji = stats.totalProfit >= 0 ? '🟢' : '🔴';
    const profitStr = stats.totalProfit >= 0
      ? `+${stats.totalProfit.toFixed(2)}u`
      : `${stats.totalProfit.toFixed(2)}u`;

    const headerMsg = `${resultEmoji} **Yesterday's Results** (${dateStr})\n\n` +
      `${aiSummary}\n\n` +
      `📊 **${stats.wins}W-${stats.losses}L-${stats.pushes}P** | **${profitStr}**`;

    // Post the recap
    const message = await channel.send({
      content: headerMsg,
      embeds: [embed],
    });

    // Record that we posted for this date
    betsRepo.recordRecapPost(dateStr, channelId, message.id);

    logger.info(`Daily recap posted for ${dateStr}: ${stats.wins}W-${stats.losses}L (${profitStr})`);
    return true;

  } catch (error) {
    logger.error('Error posting daily recap', error);
    return false;
  }
}

/**
 * Post a recap for a specific date range and tier
 */
export async function postCustomRecap(
  client: Client,
  channelId: string,
  startDate: string,
  endDate: string,
  visibility: BetVisibility
): Promise<boolean> {
  try {
    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) {
      logger.error('Guild not found');
      return false;
    }

    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (!channel) {
      logger.error(`Channel ${channelId} not found`);
      return false;
    }

    const bets = betsRepo.getSettledBets(startDate, endDate, visibility);

    if (bets.length === 0) {
      logger.info(`No bets found for recap ${startDate} to ${endDate}`);
      return false;
    }

    const stats = betsRepo.calculateStats(bets);
    const sportBreakdown = betsRepo.getBreakdownBySport(bets);
    const marketBreakdown = betsRepo.getBreakdownByMarket(bets);

    const rangeLabel = startDate === endDate
      ? startDate
      : `${startDate} to ${endDate}`;

    const embed = buildRecapEmbed(
      visibility,
      rangeLabel,
      stats,
      sportBreakdown,
      marketBreakdown,
      bets.length
    );

    await channel.send({ embeds: [embed] });

    logger.info(`Custom recap posted: ${rangeLabel}, ${visibility} tier`);
    return true;

  } catch (error) {
    logger.error('Error posting custom recap', error);
    return false;
  }
}
