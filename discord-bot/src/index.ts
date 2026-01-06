import { Client, GatewayIntentBits, Partials } from 'discord.js';
import express from 'express';
import { config, validateConfig } from './config';
import { initializeDatabase, closeDatabase } from './database';
import { registerEvents } from './events';
import { createWhopRouter, setDiscordClient } from './webhooks/whop';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  logger.info('Starting SUSSWEATSHOP Discord Bot...');

  // Validate configuration
  try {
    validateConfig();
  } catch (error) {
    logger.error('Configuration error', error);
    process.exit(1);
  }

  // Initialize database
  initializeDatabase();

  // Create Discord client with necessary intents
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [
      Partials.Channel, // For DM support
      Partials.Message,
      Partials.Reaction,
    ],
  });

  // Register event handlers
  registerEvents(client);

  // Set client for webhooks
  setDiscordClient(client);

  // Start Express server for webhooks
  const app = express();

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      discord: client.isReady() ? 'connected' : 'disconnected',
    });
  });

  // Whop webhook endpoint
  app.use('/webhooks', createWhopRouter());

  const server = app.listen(config.port, () => {
    logger.info(`Express server running on port ${config.port}`);
  });

  // Login to Discord
  try {
    await client.login(config.discord.token);
  } catch (error) {
    logger.error('Failed to login to Discord', error);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Close Express server
    server.close(() => {
      logger.info('Express server closed');
    });

    // Destroy Discord client
    client.destroy();
    logger.info('Discord client destroyed');

    // Close database
    closeDatabase();

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
  });
}

main().catch((error) => {
  logger.error('Fatal error', error);
  process.exit(1);
});
