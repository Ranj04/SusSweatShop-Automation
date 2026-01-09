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
    .addStringOption((option) =>
      option
        .setName('member')
        .setDescription('Role ID given after introduction')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('premium')
        .setDescription('Role ID for premium subscribers')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('topcontributor')
        .setDescription('Role ID for weekly top contributor')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const memberRoleId = interaction.options.getString('member');
    const premiumRoleId = interaction.options.getString('premium');
    const topContributorRoleId = interaction.options.getString('topcontributor');

    const updates: string[] = [];
    const guild = interaction.guild;

    try {
      if (memberRoleId) {
        // Validate the role exists
        const role = guild?.roles.cache.get(memberRoleId);
        if (!role) {
          await interaction.reply({
            content: `❌ Member role with ID \`${memberRoleId}\` not found.`,
            ephemeral: true,
          });
          return;
        }
        settingsRepo.set('memberRoleId', memberRoleId);
        updates.push(`Member role: ${role.name} (${memberRoleId})`);
      }

      if (premiumRoleId) {
        // Validate the role exists
        const role = guild?.roles.cache.get(premiumRoleId);
        if (!role) {
          await interaction.reply({
            content: `❌ Premium role with ID \`${premiumRoleId}\` not found.`,
            ephemeral: true,
          });
          return;
        }
        settingsRepo.set('premiumRoleId', premiumRoleId);
        updates.push(`Premium role: ${role.name} (${premiumRoleId})`);
      }

      if (topContributorRoleId) {
        // Validate the role exists
        const role = guild?.roles.cache.get(topContributorRoleId);
        if (!role) {
          await interaction.reply({
            content: `❌ Top Contributor role with ID \`${topContributorRoleId}\` not found.`,
            ephemeral: true,
          });
          return;
        }
        settingsRepo.set('topContributorRoleId', topContributorRoleId);
        updates.push(`Top Contributor role: ${role.name} (${topContributorRoleId})`);
      }

      if (updates.length === 0) {
        await interaction.reply({
          content: '⚠️ No roles specified. Use the options to configure roles.\n\nExample: `/setroles premium:1435517958704201849`',
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
