import { Client } from 'discord.js';
import cron from 'node-cron';
import { config } from '../config';
import { settingsRepo } from '../database/repositories/settings';
import { logger } from '../utils/logger';
import { postDailyPrompt } from './prompts';
import { postDailyPoll } from './polls';
import { createSweatThread } from './sweatThreads';
import { postWeeklyLeaderboard } from './leaderboard';
import { postPremiumNudge } from './premiumNudge';
import { postDailyRecap } from './dailyRecap';

export function initializeSchedulers(client: Client): void {
  logger.info('Initializing scheduled tasks...');

  // Get configured times or use defaults
  const settings = settingsRepo.getAll();
  const promptTimes = settings.promptTimes || config.defaults.promptTimes;
  const pollTime = settings.pollTime || config.defaults.pollTime;
  const sweatThreadTime = settings.sweatThreadTime || config.defaults.sweatThreadTime;

  // Schedule daily prompts
  for (const time of promptTimes) {
    const [hour, minute] = time.split(':');
    const cronExpr = `${minute} ${hour} * * *`;

    cron.schedule(cronExpr, async () => {
      logger.info(`Running scheduled prompt at ${time}`);
      await postDailyPrompt(client);
    }, {
      timezone: config.timezone,
    });

    logger.info(`Scheduled prompt at ${time}`);
  }

  // Schedule daily poll
  {
    const [hour, minute] = pollTime.split(':');
    const cronExpr = `${minute} ${hour} * * *`;

    cron.schedule(cronExpr, async () => {
      logger.info(`Running scheduled poll at ${pollTime}`);
      await postDailyPoll(client);
    }, {
      timezone: config.timezone,
    });

    logger.info(`Scheduled poll at ${pollTime}`);
  }

  // Schedule sweat thread
  {
    const [hour, minute] = sweatThreadTime.split(':');
    const cronExpr = `${minute} ${hour} * * *`;

    cron.schedule(cronExpr, async () => {
      logger.info(`Running scheduled sweat thread at ${sweatThreadTime}`);
      await createSweatThread(client);
    }, {
      timezone: config.timezone,
    });

    logger.info(`Scheduled sweat thread at ${sweatThreadTime}`);
  }

  // Schedule weekly leaderboard (Monday 9am)
  {
    const [hour, minute] = config.defaults.leaderboardTime.split(':');
    const cronExpr = `${minute} ${hour} * * 1`; // 1 = Monday

    cron.schedule(cronExpr, async () => {
      logger.info('Running weekly leaderboard');
      await postWeeklyLeaderboard(client);
    }, {
      timezone: config.timezone,
    });

    logger.info(`Scheduled weekly leaderboard: Mondays at ${config.defaults.leaderboardTime}`);
  }

  // Schedule premium nudge check (Sunday)
  {
    const cronExpr = `0 12 * * 0`; // Sunday at noon

    cron.schedule(cronExpr, async () => {
      logger.info('Running premium nudge check');
      await postPremiumNudge(client);
    }, {
      timezone: config.timezone,
    });

    logger.info('Scheduled premium nudge: Sundays at 12:00');
  }

  // Schedule daily recap (every day at 10am - posts yesterday's results)
  {
    const recapTime = settings.recapTime || '10:00';
    const [hour, minute] = recapTime.split(':');
    const cronExpr = `${minute} ${hour} * * *`;

    cron.schedule(cronExpr, async () => {
      logger.info(`Running daily recap at ${recapTime}`);
      await postDailyRecap(client);
    }, {
      timezone: config.timezone,
    });

    logger.info(`Scheduled daily recap at ${recapTime}`);
  }

  logger.info('All scheduled tasks initialized');
}
