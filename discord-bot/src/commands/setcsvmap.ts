import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import {
  csvMappingsRepo,
  INTERNAL_FIELDS,
  InternalField,
  DEFAULT_MAPPINGS,
} from '../database/repositories/csvMappings';
import { logger } from '../utils/logger';
import { Command } from './index';

export const setcsvmapCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('setcsvmap')
    .setDescription('Configure CSV column mappings for Pikkit imports')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set a column mapping')
        .addStringOption((opt) =>
          opt
            .setName('field')
            .setDescription('Internal field name')
            .setRequired(true)
            .addChoices(
              { name: 'placed_at (Date bet was placed)', value: 'placed_at' },
              { name: 'settled_at (Date bet was settled)', value: 'settled_at' },
              { name: 'sport (Sport name)', value: 'sport' },
              { name: 'league (League name)', value: 'league' },
              { name: 'market (Bet type: ML, spread, prop)', value: 'market' },
              { name: 'pick (Selection/description)', value: 'pick' },
              { name: 'odds (American or decimal odds)', value: 'odds' },
              { name: 'stake (Units risked)', value: 'stake' },
              { name: 'payout (Potential/actual payout)', value: 'payout' },
              { name: 'profit (Net profit/loss)', value: 'profit' },
              { name: 'result (Win/Loss/Push)', value: 'result' },
              { name: 'book (Sportsbook name)', value: 'book' },
              { name: 'tags (Tags/labels)', value: 'tags' },
              { name: 'visibility (FREE/PREMIUM/STAFF)', value: 'visibility' }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName('column')
            .setDescription('CSV column header name (exact match)')
            .setRequired(true)
            .setMaxLength(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View current column mappings')
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription('Reset all mappings to defaults')
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete a custom mapping')
        .addStringOption((opt) =>
          opt
            .setName('field')
            .setDescription('Internal field to delete mapping for')
            .setRequired(true)
            .addChoices(
              { name: 'placed_at', value: 'placed_at' },
              { name: 'settled_at', value: 'settled_at' },
              { name: 'sport', value: 'sport' },
              { name: 'league', value: 'league' },
              { name: 'market', value: 'market' },
              { name: 'pick', value: 'pick' },
              { name: 'odds', value: 'odds' },
              { name: 'stake', value: 'stake' },
              { name: 'payout', value: 'payout' },
              { name: 'profit', value: 'profit' },
              { name: 'result', value: 'result' },
              { name: 'book', value: 'book' },
              { name: 'tags', value: 'tags' },
              { name: 'visibility', value: 'visibility' }
            )
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'set':
        await handleSetMapping(interaction);
        break;
      case 'view':
        await handleViewMappings(interaction);
        break;
      case 'reset':
        await handleResetMappings(interaction);
        break;
      case 'delete':
        await handleDeleteMapping(interaction);
        break;
    }
  },
};

async function handleSetMapping(interaction: ChatInputCommandInteraction): Promise<void> {
  const field = interaction.options.getString('field', true) as InternalField;
  const column = interaction.options.getString('column', true);

  try {
    csvMappingsRepo.setMapping(field, column);

    await interaction.reply({
      content: `✅ Mapping set: **${field}** ← "${column}"`,
      ephemeral: true,
    });

    logger.info(`CSV mapping set: ${field} <- ${column}`, { user: interaction.user.tag });
  } catch (error) {
    logger.error('Error setting CSV mapping', error);
    await interaction.reply({
      content: '❌ Failed to set mapping',
      ephemeral: true,
    });
  }
}

async function handleViewMappings(interaction: ChatInputCommandInteraction): Promise<void> {
  const customMappings = csvMappingsRepo.getAllMappings();
  const customMap = new Map(customMappings.map((m) => [m.internal_field, m.csv_column]));

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📋 CSV Column Mappings')
    .setDescription(
      'When importing CSVs, the bot tries to match columns in this order:\n' +
      '1. Custom mappings (set with `/setcsvmap set`)\n' +
      '2. Default mappings (common column names)\n'
    );

  const lines: string[] = [];

  for (const field of INTERNAL_FIELDS) {
    const customValue = customMap.get(field);
    const defaults = DEFAULT_MAPPINGS[field].slice(0, 3).join(', ');

    if (customValue) {
      lines.push(`**${field}**\n  └ Custom: \`${customValue}\`\n  └ Defaults: ${defaults}`);
    } else {
      lines.push(`**${field}**\n  └ Defaults: ${defaults}`);
    }
  }

  // Split into chunks if too long
  const chunk1 = lines.slice(0, 7).join('\n\n');
  const chunk2 = lines.slice(7).join('\n\n');

  embed.addFields(
    { name: 'Field Mappings (1/2)', value: chunk1 || 'None', inline: false }
  );

  if (chunk2) {
    embed.addFields(
      { name: 'Field Mappings (2/2)', value: chunk2, inline: false }
    );
  }

  embed.setFooter({ text: 'Use /setcsvmap set to add custom mappings' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleResetMappings(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    csvMappingsRepo.resetToDefaults();

    await interaction.reply({
      content: '✅ All custom mappings have been cleared. Defaults will be used.',
      ephemeral: true,
    });

    logger.info('CSV mappings reset to defaults', { user: interaction.user.tag });
  } catch (error) {
    logger.error('Error resetting CSV mappings', error);
    await interaction.reply({
      content: '❌ Failed to reset mappings',
      ephemeral: true,
    });
  }
}

async function handleDeleteMapping(interaction: ChatInputCommandInteraction): Promise<void> {
  const field = interaction.options.getString('field', true) as InternalField;

  try {
    const deleted = csvMappingsRepo.deleteMapping(field);

    if (deleted) {
      await interaction.reply({
        content: `✅ Custom mapping for **${field}** deleted. Defaults will be used.`,
        ephemeral: true,
      });
      logger.info(`CSV mapping deleted: ${field}`, { user: interaction.user.tag });
    } else {
      await interaction.reply({
        content: `ℹ️ No custom mapping exists for **${field}**`,
        ephemeral: true,
      });
    }
  } catch (error) {
    logger.error('Error deleting CSV mapping', error);
    await interaction.reply({
      content: '❌ Failed to delete mapping',
      ephemeral: true,
    });
  }
}
