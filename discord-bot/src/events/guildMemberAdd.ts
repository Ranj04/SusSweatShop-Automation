import {
  Client,
  Events,
  GuildMember,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  TextChannel,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { logger } from '../utils/logger';
import { settingsRepo } from '../database/repositories/settings';
import { config } from '../config';

const SPORT_ROLES = [
  { label: 'NBA', value: 'nba', emoji: '🏀' },
  { label: 'NFL', value: 'nfl', emoji: '🏈' },
  { label: 'MLB', value: 'mlb', emoji: '⚾' },
  { label: 'NHL', value: 'nhl', emoji: '🏒' },
  { label: 'Soccer', value: 'soccer', emoji: '⚽' },
  { label: 'MMA/UFC', value: 'mma', emoji: '🥊' },
];

export function registerGuildMemberAddEvent(client: Client): void {
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    logger.info(`New member joined: ${member.user.tag} (${member.id})`);

    try {
      await sendWelcomeDM(member);
    } catch (error) {
      logger.warn(`Failed to DM ${member.user.tag}, sending to welcome channel`);
      await sendWelcomeToChannel(member);
    }
  });

  // Handle select menu interactions for sport roles
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'sport_roles') return;

    const member = interaction.member as GuildMember;
    if (!member) return;

    try {
      const guild = interaction.guild;
      if (!guild) return;

      const selectedValues = interaction.values;
      const rolesToAdd: string[] = [];

      for (const value of selectedValues) {
        // Find role by name (case-insensitive)
        const roleName = SPORT_ROLES.find((r) => r.value === value)?.label;
        if (!roleName) continue;

        const role = guild.roles.cache.find(
          (r) => r.name.toLowerCase() === roleName.toLowerCase()
        );

        if (role) {
          rolesToAdd.push(role.id);
          await member.roles.add(role).catch(() => null);
        }
      }

      await interaction.reply({
        content: `Got it! You've been assigned roles for: ${selectedValues.map((v) => SPORT_ROLES.find((r) => r.value === v)?.label).join(', ')}.\n\nNext step: Post a quick intro in the introductions channel!`,
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error handling sport role selection', error);
      await interaction.reply({
        content: 'Something went wrong assigning roles. Please contact a moderator.',
        ephemeral: true,
      }).catch(() => null);
    }
  });
}

async function sendWelcomeDM(member: GuildMember): Promise<void> {
  const introChannelId = settingsRepo.getChannelId('introductions');
  const introMention = introChannelId ? `<#${introChannelId}>` : '#introductions';

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Welcome to ${member.guild.name}!`)
    .setDescription(
      `Hey ${member.user.username}! We're stoked to have you in the community.\n\n` +
      `Here's how to get started:`
    )
    .addFields(
      {
        name: '1️⃣ Pick Your Sports',
        value: 'Select the sports you follow using the menu below. This helps us tag you for relevant picks!',
        inline: false,
      },
      {
        name: '2️⃣ Introduce Yourself',
        value: `Head to ${introMention} and drop a quick intro. Tell us:\n• Your name/nickname\n• Favorite sport(s) to bet\n• How long you've been betting\n• Your betting style (player props, spreads, etc.)`,
        inline: false,
      },
      {
        name: '3️⃣ Start Engaging',
        value: 'Check out the daily picks, join discussions, and vibe with the community!',
        inline: false,
      }
    )
    .setFooter({ text: 'SUSSWEATSHOP' })
    .setTimestamp();

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('sport_roles')
    .setPlaceholder('Select sports you follow...')
    .setMinValues(1)
    .setMaxValues(SPORT_ROLES.length)
    .addOptions(
      SPORT_ROLES.map((sport) => ({
        label: sport.label,
        value: sport.value,
        emoji: sport.emoji,
      }))
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await member.send({
    embeds: [embed],
    components: [row],
  });

  logger.info(`Sent welcome DM to ${member.user.tag}`);
}

async function sendWelcomeToChannel(member: GuildMember): Promise<void> {
  const welcomeChannelId = settingsRepo.getChannelId('welcome');
  if (!welcomeChannelId) {
    logger.warn('Welcome channel not configured');
    return;
  }

  const channel = member.guild.channels.cache.get(welcomeChannelId) as TextChannel;
  if (!channel) {
    logger.warn(`Welcome channel ${welcomeChannelId} not found`);
    return;
  }

  const introChannelId = settingsRepo.getChannelId('introductions');
  const introMention = introChannelId ? `<#${introChannelId}>` : '#introductions';

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('New Member!')
    .setDescription(
      `Welcome ${member}!\n\n` +
      `We couldn't DM you, so here's the quick rundown:\n` +
      `• Pick sport roles in the roles channel\n` +
      `• Introduce yourself in ${introMention}\n` +
      `• Check out the daily picks and join discussions!\n\n` +
      `Any questions? Just ask!`
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  await channel.send({
    content: `Hey ${member}!`,
    embeds: [embed],
  });

  logger.info(`Sent welcome message to channel for ${member.user.tag}`);
}
