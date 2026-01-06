import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { settingsRepo } from '../database/repositories/settings';
import { logger } from '../utils/logger';
import { Command } from './index';

const CHANNEL_TYPES = ['welcome', 'introductions', 'prompts', 'polls', 'sweats', 'announcements'] as const;

export const setchannelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Configure a channel for a specific purpose')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('The type of channel to configure')
        .setRequired(true)
        .addChoices(
          { name: 'Welcome', value: 'welcome' },
          { name: 'Introductions', value: 'introductions' },
          { name: 'Prompts', value: 'prompts' },
          { name: 'Polls', value: 'polls' },
          { name: 'Sweats', value: 'sweats' },
          { name: 'Announcements', value: 'announcements' }
        )
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to use')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const type = interaction.options.getString('type', true) as typeof CHANNEL_TYPES[number];
    const channel = interaction.options.getChannel('channel', true);

    try {
      settingsRepo.setChannelId(type, channel.id);

      // If setting sweats channel, also add to tracked channels for activity
      if (type === 'sweats') {
        settingsRepo.addTrackedChannel(channel.id);
      }

      await interaction.reply({
        content: `✅ ${type.charAt(0).toUpperCase() + type.slice(1)} channel set to <#${channel.id}>`,
        ephemeral: true,
      });

      logger.info(`Channel configured: ${type} -> ${channel.id}`, { user: interaction.user.tag });
    } catch (error) {
      logger.error('Error setting channel', error);
      await interaction.reply({
        content: '❌ Failed to configure channel. Please try again.',
        ephemeral: true,
      });
    }
  },
};
