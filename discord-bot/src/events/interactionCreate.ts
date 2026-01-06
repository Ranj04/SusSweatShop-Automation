import { Client, Events, Interaction } from 'discord.js';
import { logger } from '../utils/logger';
import { commands } from '../commands';

export function registerInteractionCreateEvent(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    // Only handle slash commands here (select menus handled in guildMemberAdd)
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }

    try {
      logger.debug(`Executing command: ${interaction.commandName}`, {
        user: interaction.user.tag,
        guild: interaction.guild?.name,
      });

      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error executing command ${interaction.commandName}`, error);

      const errorMessage = 'There was an error executing this command.';

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(() => null);
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => null);
      }
    }
  });
}
