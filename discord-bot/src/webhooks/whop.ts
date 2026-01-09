import express, { Request, Response, Router } from 'express';
import crypto from 'crypto';
import { Client, GuildMember } from 'discord.js';
import { config } from '../config';
import { settingsRepo } from '../database/repositories/settings';
import { subscriptionsRepo } from '../database/repositories/subscriptions';
import { logger } from '../utils/logger';

/**
 * Whop Webhook Events:
 * - membership.went_valid: Subscription became active
 * - membership.went_invalid: Subscription expired/canceled
 * - membership.cancelled: User canceled (may still have access until end of period)
 */

interface WhopWebhookPayload {
  action: string;
  data: {
    id: string;
    product: { id: string; name: string };
    user: {
      id: string;
      username: string;
      email: string;
      discord?: {
        id: string;
        username: string;
      };
    };
    status: string;
    valid: boolean;
    cancel_at_period_end: boolean;
    created_at: number;
    renewal_period_start: number;
    renewal_period_end: number;
  };
}

let discordClient: Client | null = null;

export function setDiscordClient(client: Client): void {
  discordClient = client;
}

export function createWhopRouter(): Router {
  const router = Router();

  // GET handler for Whop webhook verification
  router.get('/whop', (req: Request, res: Response) => {
    logger.info('Whop webhook verification request received');
    res.status(200).json({
      status: 'ok',
      message: 'SUSSWEATSHOP Whop webhook endpoint is ready'
    });
  });

  router.post('/whop', express.json(), async (req: Request, res: Response) => {
    try {
      // Verify webhook signature
      if (!verifySignature(req)) {
        logger.warn('Invalid Whop webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const payload = req.body as WhopWebhookPayload;
      logger.info(`Whop webhook received: ${payload.action}`, {
        userId: payload.data.user.id,
        discordId: payload.data.user.discord?.id,
      });

      // Handle the event
      await handleWebhookEvent(payload);

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Error processing Whop webhook', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

function verifySignature(req: Request): boolean {
  const secret = config.whop.webhookSecret;
  if (!secret) {
    logger.warn('Whop webhook secret not configured');
    return true; // Skip verification in development
  }

  const signature = req.headers['whop-signature'] as string;
  if (!signature) {
    return false;
  }

  const body = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

async function handleWebhookEvent(payload: WhopWebhookPayload): Promise<void> {
  const { action, data } = payload;
  const discordId = data.user.discord?.id;
  const whopCustomerId = data.user.id;

  if (!discordId) {
    logger.warn('Whop webhook: No Discord ID linked', { whopCustomerId });
    return;
  }

  switch (action) {
    case 'membership.went_valid':
      await handleSubscriptionActive(discordId, whopCustomerId);
      break;

    case 'membership.went_invalid':
      await handleSubscriptionInvalid(discordId, whopCustomerId);
      break;

    case 'membership.cancelled':
      // User canceled but may still have access until period end
      logger.info(`Subscription canceled (still active until period end): ${discordId}`);
      subscriptionsRepo.upsert(discordId, whopCustomerId, 'active');
      break;

    default:
      logger.debug(`Unhandled Whop event: ${action}`);
  }
}

async function handleSubscriptionActive(discordId: string, whopCustomerId: string): Promise<void> {
  logger.info(`Subscription active: ${discordId}`);

  // Save to database
  subscriptionsRepo.upsert(discordId, whopCustomerId, 'active');

  // Assign Premium role
  if (discordClient) {
    await assignPremiumRole(discordId);
  }
}

async function handleSubscriptionInvalid(discordId: string, whopCustomerId: string): Promise<void> {
  logger.info(`Subscription invalid: ${discordId}`);

  // Update database
  subscriptionsRepo.upsert(discordId, whopCustomerId, 'expired');

  // Remove Premium role
  if (discordClient) {
    await removePremiumRole(discordId);
  }
}

async function assignPremiumRole(discordId: string): Promise<void> {
  try {
    const guild = discordClient?.guilds.cache.get(config.discord.guildId);
    if (!guild) return;

    const premiumRoleId = settingsRepo.get('premiumRoleId');
    if (!premiumRoleId) {
      logger.warn('Premium role not configured');
      return;
    }

    const role = guild.roles.cache.get(premiumRoleId);
    if (!role) {
      logger.warn(`Premium role ${premiumRoleId} not found`);
      return;
    }

    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) {
      logger.warn(`Member ${discordId} not found in guild`);
      return;
    }

    await member.roles.add(role);
    logger.info(`Assigned Premium role to ${member.user.tag}`);

    // Optionally DM the user
    try {
      await member.send({
        content: `🎉 **Welcome to SUSSWEATSHOP Premium!**\n\n` +
          `Your subscription is now active. You have access to:\n` +
          `• VIP Picks Channel\n` +
          `• Early Access to plays\n` +
          `• Detailed analysis\n` +
          `• And more!\n\n` +
          `Thanks for supporting us. Let's get this bread! 💰`,
      });
    } catch {
      // DMs may be disabled
    }
  } catch (error) {
    logger.error('Error assigning premium role', error);
  }
}

async function removePremiumRole(discordId: string): Promise<void> {
  try {
    const guild = discordClient?.guilds.cache.get(config.discord.guildId);
    if (!guild) return;

    const premiumRoleId = settingsRepo.get('premiumRoleId');
    if (!premiumRoleId) return;

    const role = guild.roles.cache.get(premiumRoleId);
    if (!role) return;

    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) return;

    if (member.roles.cache.has(premiumRoleId)) {
      await member.roles.remove(role);
      logger.info(`Removed Premium role from ${member.user.tag}`);
    }
  } catch (error) {
    logger.error('Error removing premium role', error);
  }
}
