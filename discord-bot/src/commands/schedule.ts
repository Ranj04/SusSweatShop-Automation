import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { settingsRepo } from '../database/repositories/settings';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Command } from './index';

export const scheduleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('View or configure scheduled task times')
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View current schedule')
    )
    .addSubcommand((sub) =>
      sub
        .setName('prompts')
        .setDescription('Set prompt times (comma-separated, 24h format)')
        .addStringOption((opt) =>
          opt
            .setName('times')
            .setDescription('Times like: 10:00,16:00,19:00')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('poll')
        .setDescription('Set daily poll time')
        .addStringOption((opt) =>
          opt
            .setName('time')
            .setDescription('Time like: 12:00')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('sweatthread')
        .setDescription('Set sweat thread creation time')
        .addStringOption((opt) =>
          opt
            .setName('time')
            .setDescription('Time like: 17:00')
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'view') {
      await viewSchedule(interaction);
    } else if (subcommand === 'prompts') {
      await setPromptTimes(interaction);
    } else if (subcommand === 'poll') {
      await setPollTime(interaction);
    } else if (subcommand === 'sweatthread') {
      await setSweatThreadTime(interaction);
    }
  },
};

async function viewSchedule(interaction: ChatInputCommandInteraction): Promise<void> {
  const settings = settingsRepo.getAll();

  const promptTimes = settings.promptTimes || config.defaults.promptTimes;
  const pollTime = settings.pollTime || config.defaults.pollTime;
  const sweatThreadTime = settings.sweatThreadTime || config.defaults.sweatThreadTime;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📅 Scheduled Tasks')
    .addFields(
      {
        name: '💬 Daily Prompts',
        value: promptTimes.join(', ') + ` (${config.timezone})`,
        inline: false,
      },
      {
        name: '📊 Daily Poll',
        value: pollTime + ` (${config.timezone})`,
        inline: false,
      },
      {
        name: '🔥 Sweat Thread',
        value: sweatThreadTime + ` (${config.timezone})`,
        inline: false,
      },
      {
        name: '🏆 Weekly Leaderboard',
        value: `${config.defaults.leaderboardTime} on Mondays (${config.timezone})`,
        inline: false,
      },
      {
        name: '💎 Premium Nudge',
        value: 'Sundays (if 7+ days since last)',
        inline: false,
      }
    )
    .setFooter({ text: `Timezone: ${config.timezone}` });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

function validateTimeFormat(time: string): boolean {
  return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

async function setPromptTimes(interaction: ChatInputCommandInteraction): Promise<void> {
  const timesStr = interaction.options.getString('times', true);
  const times = timesStr.split(',').map((t) => t.trim());

  // Validate all times
  for (const time of times) {
    if (!validateTimeFormat(time)) {
      await interaction.reply({
        content: `❌ Invalid time format: "${time}". Use 24h format like 10:00, 16:00`,
        ephemeral: true,
      });
      return;
    }
  }

  try {
    settingsRepo.setJson('promptTimes', times);
    await interaction.reply({
      content: `✅ Prompt times set to: ${times.join(', ')}\n\n⚠️ Restart the bot for changes to take effect.`,
      ephemeral: true,
    });
    logger.info(`Prompt times updated: ${times.join(', ')}`);
  } catch (error) {
    logger.error('Error setting prompt times', error);
    await interaction.reply({
      content: '❌ Failed to update schedule.',
      ephemeral: true,
    });
  }
}

async function setPollTime(interaction: ChatInputCommandInteraction): Promise<void> {
  const time = interaction.options.getString('time', true).trim();

  if (!validateTimeFormat(time)) {
    await interaction.reply({
      content: `❌ Invalid time format. Use 24h format like 12:00`,
      ephemeral: true,
    });
    return;
  }

  try {
    settingsRepo.set('pollTime', time);
    await interaction.reply({
      content: `✅ Poll time set to: ${time}\n\n⚠️ Restart the bot for changes to take effect.`,
      ephemeral: true,
    });
    logger.info(`Poll time updated: ${time}`);
  } catch (error) {
    logger.error('Error setting poll time', error);
    await interaction.reply({
      content: '❌ Failed to update schedule.',
      ephemeral: true,
    });
  }
}

async function setSweatThreadTime(interaction: ChatInputCommandInteraction): Promise<void> {
  const time = interaction.options.getString('time', true).trim();

  if (!validateTimeFormat(time)) {
    await interaction.reply({
      content: `❌ Invalid time format. Use 24h format like 17:00`,
      ephemeral: true,
    });
    return;
  }

  try {
    settingsRepo.set('sweatThreadTime', time);
    await interaction.reply({
      content: `✅ Sweat thread time set to: ${time}\n\n⚠️ Restart the bot for changes to take effect.`,
      ephemeral: true,
    });
    logger.info(`Sweat thread time updated: ${time}`);
  } catch (error) {
    logger.error('Error setting sweat thread time', error);
    await interaction.reply({
      content: '❌ Failed to update schedule.',
      ephemeral: true,
    });
  }
}
