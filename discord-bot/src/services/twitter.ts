import { Message, Attachment } from 'discord.js';
import { spawn } from 'child_process';
import { logger } from '../utils/logger';
import path from 'path';

// Betting slip domains to look for
const SLIP_DOMAINS = ['prizepicks', 'underdogfantasy', 'sleeper', 'betslip', 'draftkings', 'fanduel'];

// URL regex pattern
const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

/**
 * Check if a message has both a link and an image attachment
 */
export function hasLinkAndImage(message: Message): { hasLink: boolean; hasImage: boolean; link: string | null } {
  // Check for image attachments
  const hasImage = message.attachments.some((att: Attachment) =>
    att.contentType?.startsWith('image/') || false
  );

  // Check for links in content
  const links = message.content.match(URL_PATTERN) || [];
  const slipLink = links.find(link =>
    SLIP_DOMAINS.some(domain => link.toLowerCase().includes(domain))
  ) || links[0] || null;

  return {
    hasLink: links.length > 0,
    hasImage,
    link: slipLink,
  };
}

/**
 * Trigger Twitter posting for a Discord message
 * Calls the Python script to handle the actual posting
 */
export async function postToTwitter(message: Message): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Path to the Python script (relative to discord-bot folder)
      const scriptPath = path.resolve(__dirname, '../../../src/main.py');

      logger.info(`Triggering Twitter post for message ${message.id}`);

      // Spawn Python process
      const python = spawn('python', [scriptPath, '--max-posts', '1'], {
        cwd: path.resolve(__dirname, '../../../'),
        env: process.env,
      });

      let output = '';
      let errorOutput = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          logger.info(`Twitter post successful: ${output.slice(-200)}`);
          resolve(true);
        } else {
          logger.error(`Twitter post failed (code ${code}): ${errorOutput}`);
          resolve(false);
        }
      });

      python.on('error', (err) => {
        logger.error('Failed to spawn Python process', err);
        resolve(false);
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        python.kill();
        logger.warn('Twitter post timed out');
        resolve(false);
      }, 60000);

    } catch (error) {
      logger.error('Error triggering Twitter post', error);
      resolve(false);
    }
  });
}
