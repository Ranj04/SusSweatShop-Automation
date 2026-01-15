import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { logger } from '../utils/logger';
import { BetStats, BetBreakdown } from '../database/repositories/bets';

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI | null {
  if (!config.gemini.apiKey) {
    logger.warn('Gemini API key not configured');
    return null;
  }

  if (!genAI) {
    genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }

  return genAI;
}

interface RecapData {
  date: string;
  stats: BetStats;
  sportBreakdown: BetBreakdown[];
  marketBreakdown: BetBreakdown[];
  totalBets: number;
}

/**
 * Generate a human-sounding recap summary using Gemini
 */
export async function generateRecapSummary(data: RecapData): Promise<string> {
  const client = getClient();

  if (!client) {
    return generateFallbackSummary(data);
  }

  try {
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = buildRecapPrompt(data);

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text().trim();

    // Clean up any markdown or unwanted formatting
    const cleaned = text
      .replace(/```/g, '')
      .replace(/\*\*/g, '')
      .trim();

    if (cleaned.length < 20) {
      return generateFallbackSummary(data);
    }

    logger.info('Generated AI recap summary');
    return cleaned;

  } catch (error) {
    logger.error('Error generating AI recap summary', error);
    return generateFallbackSummary(data);
  }
}

function buildRecapPrompt(data: RecapData): string {
  const { stats, sportBreakdown, date } = data;
  const isWinningDay = stats.totalProfit > 0;
  const isLosingDay = stats.totalProfit < 0;
  const winRate = stats.wins + stats.losses > 0
    ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(0)
    : '0';

  // Build sport summary
  const sportSummary = sportBreakdown.slice(0, 3).map(s =>
    `${s.category}: ${s.wins}W-${s.losses}L (${s.profit >= 0 ? '+' : ''}${s.profit.toFixed(1)}u)`
  ).join(', ');

  return `Generate a short, human-sounding Discord message (2-3 sentences max) summarizing yesterday's betting results.

Stats:
- Date: ${date}
- Record: ${stats.wins}W-${stats.losses}L-${stats.pushes}P
- Win Rate: ${winRate}%
- Profit: ${stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit.toFixed(2)} units
- ROI: ${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%
- Sports: ${sportSummary || 'Mixed'}

Requirements:
- Sound natural and conversational, like a real person posting
- ${isWinningDay ? 'Be excited but not over the top about the winning day' : isLosingDay ? 'Acknowledge the loss but stay positive about bouncing back' : 'Note the break-even day and mention getting back at it'}
- Include the record and profit/loss
- Keep it SHORT - 2-3 sentences max
- Don't use hashtags or emojis at the start
- End with something forward-looking (tomorrow, next plays, etc.)
- Don't say "we" excessively

Example good outputs:
"Solid day yesterday going 5-2 for +3.2 units. Props came through big. Back at it tomorrow with more plays."
"Tough one yesterday, 2-4 for -2.1 units. It happens. Shaking it off and coming back stronger tomorrow."
"Broke even at 3-3 yesterday. Sometimes that's how it goes. Got some good looks lined up for today though."`;
}

function generateFallbackSummary(data: RecapData): string {
  const { stats, date } = data;
  const profitStr = stats.totalProfit >= 0
    ? `+${stats.totalProfit.toFixed(2)}`
    : stats.totalProfit.toFixed(2);

  if (stats.totalProfit > 0) {
    return `Solid day yesterday (${date}) going ${stats.wins}-${stats.losses} for ${profitStr} units. Back at it tomorrow with more plays.`;
  } else if (stats.totalProfit < 0) {
    return `Tough one yesterday (${date}), ${stats.wins}-${stats.losses} for ${profitStr} units. Shaking it off and coming back stronger.`;
  } else {
    return `Broke even yesterday (${date}) at ${stats.wins}-${stats.losses}. Sometimes that's how it goes. Back tomorrow with fresh plays.`;
  }
}

/**
 * Generate a hype message for a big winning day
 */
export async function generateBigWinMessage(
  profit: number,
  record: string,
  bestPick?: string
): Promise<string> {
  const client = getClient();

  if (!client) {
    return `Huge day! ${record} for +${profit.toFixed(2)} units! Let's keep it rolling.`;
  }

  try {
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Generate a short, excited Discord message (1-2 sentences) celebrating a big winning day in sports betting.

Stats:
- Record: ${record}
- Profit: +${profit.toFixed(2)} units
${bestPick ? `- Best pick: ${bestPick}` : ''}

Requirements:
- Sound genuinely excited but not cringe
- Keep it SHORT (1-2 sentences)
- Mention the profit
- Don't use excessive emojis
- Sound like a real person, not a bot`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();

  } catch (error) {
    logger.error('Error generating big win message', error);
    return `Huge day! ${record} for +${profit.toFixed(2)} units! Let's keep it rolling.`;
  }
}
