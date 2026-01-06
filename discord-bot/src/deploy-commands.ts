import { REST, Routes } from 'discord.js';
import { config, validateConfig } from './config';
import { getCommandsData } from './commands';
import { logger } from './utils/logger';

async function deployCommands(): Promise<void> {
  try {
    validateConfig();

    const commands = getCommandsData();
    logger.info(`Deploying ${commands.length} commands...`);

    const rest = new REST().setToken(config.discord.token);

    // Deploy to specific guild (faster for development)
    const data = await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body: commands }
    ) as unknown[];

    logger.info(`Successfully deployed ${data.length} commands to guild ${config.discord.guildId}`);

    // Optionally deploy globally (takes up to 1 hour to propagate)
    // await rest.put(
    //   Routes.applicationCommands(config.discord.clientId),
    //   { body: commands }
    // );
    // logger.info('Successfully deployed commands globally');

  } catch (error) {
    logger.error('Error deploying commands', error);
    process.exit(1);
  }
}

deployCommands();
