import { Client, Events } from 'discord.js';
import { logger } from '../utils/logger';
import { initializeSchedulers } from '../schedulers';

export function registerReadyEvent(client: Client): void {
  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`Bot is ready! Logged in as ${readyClient.user.tag}`);
    logger.info(`Serving ${readyClient.guilds.cache.size} guild(s)`);

    // Initialize scheduled tasks
    initializeSchedulers(client);
  });
}
