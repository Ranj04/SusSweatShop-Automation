import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { promptsRepo } from '../database/repositories/prompts';
import { logger } from '../utils/logger';
import { Command } from './index';

export const addpromptCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('addprompt')
    .setDescription('Add a new daily prompt')
    .addStringOption((option) =>
      option
        .setName('text')
        .setDescription('The prompt text (use {sport} for sport variable)')
        .setRequired(true)
        .setMaxLength(500)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const text = interaction.options.getString('text', true);

    try {
      const id = promptsRepo.add(text);
      const total = promptsRepo.count();

      await interaction.reply({
        content: `✅ Prompt added (ID: ${id})\n\`\`\`${text}\`\`\`\nTotal prompts: ${total}`,
        ephemeral: true,
      });

      logger.info(`Prompt added: "${text}"`, { user: interaction.user.tag });
    } catch (error) {
      logger.error('Error adding prompt', error);
      await interaction.reply({
        content: '❌ Failed to add prompt. Please try again.',
        ephemeral: true,
      });
    }
  },
};
