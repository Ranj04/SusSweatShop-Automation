import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  GuildMember,
} from 'discord.js';
import { logger } from '../utils/logger';
import { postDailyPrompt } from '../schedulers/prompts';
import { postDailyPoll } from '../schedulers/polls';
import { createSweatThread } from '../schedulers/sweatThreads';
import { Command } from './index';

export const testCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Test bot features')
    .addStringOption((option) =>
      option
        .setName('feature')
        .setDescription('Feature to test')
        .setRequired(true)
        .addChoices(
          { name: 'Onboarding (simulate)', value: 'onboarding' },
          { name: 'Daily Prompt', value: 'prompt' },
          { name: 'Daily Poll', value: 'poll' },
          { name: 'Sweat Thread', value: 'thread' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const feature = interaction.options.getString('feature', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      switch (feature) {
        case 'onboarding':
          await testOnboarding(interaction);
          break;
        case 'prompt':
          await testPrompt(interaction);
          break;
        case 'poll':
          await testPoll(interaction);
          break;
        case 'thread':
          await testThread(interaction);
          break;
      }
    } catch (error) {
      logger.error(`Test failed: ${feature}`, error);
      await interaction.editReply({
        content: `❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  },
};

async function testOnboarding(interaction: ChatInputCommandInteraction): Promise<void> {
  // We can't fully simulate guildMemberAdd, but we can test the DM
  await interaction.editReply({
    content: `ℹ️ Onboarding test:\n` +
      `• The bot sends a welcome DM when a new member joins\n` +
      `• If DM fails, it posts in the configured welcome channel\n` +
      `• Members can select sport roles from the DM\n` +
      `• After posting in #introductions, they get the Member role + ✅ reaction\n\n` +
      `To fully test, have someone join the server or create a test account.`,
  });
}

async function testPrompt(interaction: ChatInputCommandInteraction): Promise<void> {
  const client = interaction.client;

  await interaction.editReply({ content: '⏳ Posting test prompt...' });

  const success = await postDailyPrompt(client);

  if (success) {
    await interaction.editReply({ content: '✅ Daily prompt posted successfully!' });
  } else {
    await interaction.editReply({
      content: '❌ Failed to post prompt. Check that the prompts channel is configured with `/setchannel type:prompts`',
    });
  }
}

async function testPoll(interaction: ChatInputCommandInteraction): Promise<void> {
  const client = interaction.client;

  await interaction.editReply({ content: '⏳ Posting test poll...' });

  const success = await postDailyPoll(client);

  if (success) {
    await interaction.editReply({ content: '✅ Daily poll posted successfully!' });
  } else {
    await interaction.editReply({
      content: '❌ Failed to post poll. Check that the polls channel is configured with `/setchannel type:polls`',
    });
  }
}

async function testThread(interaction: ChatInputCommandInteraction): Promise<void> {
  const client = interaction.client;

  await interaction.editReply({ content: '⏳ Creating test sweat thread...' });

  const success = await createSweatThread(client);

  if (success) {
    await interaction.editReply({ content: '✅ Sweat thread created successfully!' });
  } else {
    await interaction.editReply({
      content: '❌ Failed to create thread. Check that the sweats channel is configured with `/setchannel type:sweats`',
    });
  }
}
