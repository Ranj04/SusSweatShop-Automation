import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { settingsRepo } from '../database/repositories/settings';
import { logger } from '../utils/logger';
import { Command } from './index';

export const trackchannelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('trackchannel')
    .setDescription('Manage channels tracked for activity/leaderboard')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a channel to activity tracking')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to track')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a channel from activity tracking')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to untrack')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List all tracked channels')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
      const channel = interaction.options.getChannel('channel', true);
      settingsRepo.addTrackedChannel(channel.id);
      await interaction.reply({
        content: `✅ <#${channel.id}> is now being tracked for activity.`,
        ephemeral: true,
      });
      logger.info(`Channel added to tracking: ${channel.id}`);
    } else if (subcommand === 'remove') {
      const channel = interaction.options.getChannel('channel', true);
      settingsRepo.removeTrackedChannel(channel.id);
      await interaction.reply({
        content: `✅ <#${channel.id}> is no longer being tracked.`,
        ephemeral: true,
      });
      logger.info(`Channel removed from tracking: ${channel.id}`);
    } else if (subcommand === 'list') {
      const channels = settingsRepo.getTrackedChannels();
      if (channels.length === 0) {
        await interaction.reply({
          content: 'No channels are currently being tracked for activity.',
          ephemeral: true,
        });
      } else {
        const channelMentions = channels.map((id) => `<#${id}>`).join('\n');
        await interaction.reply({
          content: `📊 **Tracked Channels:**\n${channelMentions}`,
          ephemeral: true,
        });
      }
    }
  },
};
