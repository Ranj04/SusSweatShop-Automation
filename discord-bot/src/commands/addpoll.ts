import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { pollsRepo } from '../database/repositories/polls';
import { logger } from '../utils/logger';
import { Command } from './index';

export const addpollCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('addpoll')
    .setDescription('Add a new poll')
    .addStringOption((option) =>
      option
        .setName('question')
        .setDescription('The poll question')
        .setRequired(true)
        .setMaxLength(300)
    )
    .addStringOption((option) =>
      option
        .setName('options')
        .setDescription('Poll options (comma-separated, 2-4 options)')
        .setRequired(true)
        .setMaxLength(500)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const question = interaction.options.getString('question', true);
    const optionsStr = interaction.options.getString('options', true);

    // Parse options
    const options = optionsStr
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    if (options.length < 2 || options.length > 4) {
      await interaction.reply({
        content: '❌ Please provide 2-4 options separated by commas.',
        ephemeral: true,
      });
      return;
    }

    try {
      const id = pollsRepo.add(question, options);
      const total = pollsRepo.count();

      await interaction.reply({
        content: `✅ Poll added (ID: ${id})\n**Question:** ${question}\n**Options:**\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\nTotal polls: ${total}`,
        ephemeral: true,
      });

      logger.info(`Poll added: "${question}"`, { user: interaction.user.tag });
    } catch (error) {
      logger.error('Error adding poll', error);
      await interaction.reply({
        content: '❌ Failed to add poll. Please try again.',
        ephemeral: true,
      });
    }
  },
};
