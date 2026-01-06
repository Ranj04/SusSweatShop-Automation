import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Attachment,
} from 'discord.js';
import { betsRepo } from '../database/repositories/bets';
import { processCSV } from '../utils/csvParser';
import { logger } from '../utils/logger';
import { Command } from './index';
import { InternalField } from '../database/repositories/csvMappings';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const importpikkitcsvCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('importpikkitcsv')
    .setDescription('Import bets from a Pikkit CSV export file')
    .addAttachmentOption((option) =>
      option
        .setName('file')
        .setDescription('CSV file exported from Pikkit')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('default_visibility')
        .setDescription('Default visibility for imported bets (overridden by CSV data)')
        .setRequired(false)
        .addChoices(
          { name: 'Staff Only', value: 'STAFF' },
          { name: 'Premium', value: 'PREMIUM' },
          { name: 'Free', value: 'FREE' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const attachment = interaction.options.getAttachment('file', true);
    const defaultVisibility = (interaction.options.getString('default_visibility') || 'STAFF') as 'FREE' | 'PREMIUM' | 'STAFF';

    // Validate file
    if (!attachment.name?.toLowerCase().endsWith('.csv')) {
      await interaction.editReply({
        content: '❌ Please upload a CSV file (.csv extension required)',
      });
      return;
    }

    if (attachment.size > MAX_FILE_SIZE) {
      await interaction.editReply({
        content: `❌ File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      });
      return;
    }

    try {
      // Download file content
      const response = await fetch(attachment.url);
      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const content = await response.text();

      // Process CSV
      const { bets, headers, mapping, errors, skipped } = processCSV(content);

      if (bets.length === 0) {
        const errorMsg = errors.length > 0
          ? `\n\nErrors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more` : ''}`
          : '';

        await interaction.editReply({
          content: `❌ No valid bets found in CSV.${errorMsg}`,
        });
        return;
      }

      // Apply default visibility to bets that defaulted to STAFF
      const processedBets = bets.map((bet) => ({
        ...bet,
        visibility: bet.visibility === 'STAFF' ? defaultVisibility : bet.visibility,
      }));

      // Insert bets (dedupe handled internally)
      const insertedCount = betsRepo.bulkInsert(processedBets);
      const duplicateCount = processedBets.length - insertedCount;

      // Build mapping display
      const mappingLines: string[] = [];
      for (const [field, column] of mapping.entries()) {
        mappingLines.push(`• ${field} ← "${column}"`);
      }

      // Unmapped fields
      const unmappedFields: string[] = [];
      const requiredFields: InternalField[] = ['pick', 'odds', 'stake', 'result'];
      for (const field of requiredFields) {
        if (!mapping.has(field)) {
          unmappedFields.push(field);
        }
      }

      // Build result embed
      const embed = new EmbedBuilder()
        .setColor(insertedCount > 0 ? 0x00ff00 : 0xffaa00)
        .setTitle('📊 CSV Import Complete')
        .addFields(
          {
            name: '📁 File',
            value: attachment.name,
            inline: true,
          },
          {
            name: '📝 Total Rows',
            value: `${bets.length + skipped}`,
            inline: true,
          },
          {
            name: '\u200B',
            value: '\u200B',
            inline: true,
          },
          {
            name: '✅ Imported',
            value: `${insertedCount}`,
            inline: true,
          },
          {
            name: '🔄 Duplicates',
            value: `${duplicateCount}`,
            inline: true,
          },
          {
            name: '⚠️ Skipped',
            value: `${skipped}`,
            inline: true,
          }
        );

      // Add mapping info
      if (mappingLines.length > 0) {
        embed.addFields({
          name: '🔗 Column Mapping Used',
          value: mappingLines.slice(0, 10).join('\n') + (mappingLines.length > 10 ? '\n...' : ''),
          inline: false,
        });
      }

      // Add warnings for unmapped fields
      if (unmappedFields.length > 0) {
        embed.addFields({
          name: '⚠️ Unmapped Fields',
          value: `The following fields were not found in CSV:\n${unmappedFields.join(', ')}\n\nUse \`/setcsvmap\` to configure custom column mappings.`,
          inline: false,
        });
      }

      // Add errors if any
      if (errors.length > 0) {
        const errorText = errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n... and ${errors.length - 5} more` : '');
        embed.addFields({
          name: '❌ Errors',
          value: errorText.slice(0, 1024),
          inline: false,
        });
      }

      embed.setFooter({ text: `Total bets in database: ${betsRepo.count()}` });
      embed.setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      logger.info(`CSV import: ${insertedCount} inserted, ${duplicateCount} duplicates, ${skipped} skipped`, {
        user: interaction.user.tag,
        file: attachment.name,
      });

    } catch (error) {
      logger.error('Error importing CSV', error);
      await interaction.editReply({
        content: `❌ Error processing CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  },
};
