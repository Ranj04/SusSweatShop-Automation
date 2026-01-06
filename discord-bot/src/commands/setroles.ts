import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { settingsRepo } from '../database/repositories/settings';
import { logger } from '../utils/logger';
import { Command } from './index';

export const setrolesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('setroles')
    .setDescription('Configure roles for the bot')
    .addRoleOption((option) =>
      option
        .setName('member')
        .setDescription('Role given after introduction')
        .setRequired(false)
    )
    .addRoleOption((option) =>
      option
        .setName('premium')
        .setDescription('Role for premium subscribers')
        .setRequired(false)
    )
    .addRoleOption((option) =>
      option
        .setName('topcontributor')
        .setDescription('Role for weekly top contributor')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const memberRole = interaction.options.getRole('member');
    const premiumRole = interaction.options.getRole('premium');
    const topContributorRole = interaction.options.getRole('topcontributor');

    const updates: string[] = [];

    try {
      if (memberRole) {
        settingsRepo.set('memberRoleId', memberRole.id);
        updates.push(`Member role: ${memberRole.name}`);
      }

      if (premiumRole) {
        settingsRepo.set('premiumRoleId', premiumRole.id);
        updates.push(`Premium role: ${premiumRole.name}`);
      }

      if (topContributorRole) {
        settingsRepo.set('topContributorRoleId', topContributorRole.id);
        updates.push(`Top Contributor role: ${topContributorRole.name}`);
      }

      if (updates.length === 0) {
        await interaction.reply({
          content: '⚠️ No roles specified. Use the options to configure roles.',
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: `✅ Roles configured:\n${updates.map((u) => `• ${u}`).join('\n')}`,
        ephemeral: true,
      });

      logger.info(`Roles configured: ${updates.join(', ')}`, { user: interaction.user.tag });
    } catch (error) {
      logger.error('Error setting roles', error);
      await interaction.reply({
        content: '❌ Failed to configure roles. Please try again.',
        ephemeral: true,
      });
    }
  },
};
