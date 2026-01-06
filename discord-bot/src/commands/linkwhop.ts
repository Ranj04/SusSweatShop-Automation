import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { subscriptionsRepo } from '../database/repositories/subscriptions';
import { settingsRepo } from '../database/repositories/settings';
import { logger } from '../utils/logger';
import { config } from '../config';
import { Command } from './index';

// Simple in-memory store for pending link codes
// In production, you'd want to store these in SQLite with expiration
const pendingCodes = new Map<string, { discordId: string; expiresAt: number }>();

export const linkwhopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('linkwhop')
    .setDescription('Link your Discord account to Whop subscription')
    .addStringOption((opt) =>
      opt
        .setName('code')
        .setDescription('Your Whop link code (provided by staff)')
        .setRequired(true)
        .setMinLength(6)
        .setMaxLength(20)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const code = interaction.options.getString('code', true).toUpperCase();

    try {
      // Check if code exists and is valid
      const pending = pendingCodes.get(code);

      if (!pending) {
        await interaction.reply({
          content: '❌ Invalid or expired code. Please contact staff for a new code.',
          ephemeral: true,
        });
        return;
      }

      if (Date.now() > pending.expiresAt) {
        pendingCodes.delete(code);
        await interaction.reply({
          content: '❌ This code has expired. Please contact staff for a new code.',
          ephemeral: true,
        });
        return;
      }

      // Check if user already has a subscription linked
      const existingSub = subscriptionsRepo.findByDiscordId(interaction.user.id);
      if (existingSub && existingSub.status === 'active') {
        await interaction.reply({
          content: '✅ Your account is already linked to an active subscription!',
          ephemeral: true,
        });
        return;
      }

      // Link the account (code contains whopCustomerId)
      const whopCustomerId = code; // In real impl, code would map to whopCustomerId
      subscriptionsRepo.upsert(interaction.user.id, whopCustomerId, 'active');

      // Assign Premium role
      const premiumRoleId = settingsRepo.get('premiumRoleId');
      if (premiumRoleId && interaction.guild) {
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (member) {
          const role = interaction.guild.roles.cache.get(premiumRoleId);
          if (role) {
            await member.roles.add(role).catch(() => null);
          }
        }
      }

      // Remove used code
      pendingCodes.delete(code);

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🎉 Account Linked!')
        .setDescription(
          'Your Discord account has been successfully linked to your Whop subscription.\n\n' +
          'You now have access to Premium features!'
        )
        .setFooter({ text: 'SUSSWEATSHOP Premium' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

      logger.info(`Whop account linked: ${interaction.user.tag}`, {
        userId: interaction.user.id,
        code,
      });

    } catch (error) {
      logger.error('Error linking Whop account', error);
      await interaction.reply({
        content: '❌ An error occurred. Please try again or contact staff.',
        ephemeral: true,
      });
    }
  },
};

/**
 * Generate a link code for a user (called by staff)
 */
export function generateLinkCode(whopCustomerId: string): string {
  const code = `WHOP${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

  pendingCodes.set(code, {
    discordId: whopCustomerId,
    expiresAt,
  });

  return code;
}

/**
 * Create a link code directly for a Discord user (admin use)
 */
export function createDirectLinkCode(discordId: string): string {
  const code = `LINK${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

  pendingCodes.set(code, {
    discordId,
    expiresAt,
  });

  return code;
}
