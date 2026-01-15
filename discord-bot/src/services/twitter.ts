import { Message, Attachment } from 'discord.js';
import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { generateTweetFromSlip } from './gemini';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Betting slip domains to look for
const SLIP_DOMAINS = ['prizepicks', 'underdogfantasy', 'sleeper', 'betslip', 'draftkings', 'fanduel'];

// URL regex pattern
const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

// Initialize Twitter client
function getTwitterClient(): TwitterApi | null {
  const { apiKey, apiSecret, accessToken, accessTokenSecret } = config.twitter;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    logger.warn('Twitter credentials not configured');
    return null;
  }

  return new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken: accessToken,
    accessSecret: accessTokenSecret,
  });
}

/**
 * Check if a message has both a link and an image attachment
 */
export function hasLinkAndImage(message: Message): { hasLink: boolean; hasImage: boolean; link: string | null; imageUrl: string | null } {
  // Check for image attachments (actual uploads, not embeds)
  const imageAttachment = message.attachments.find((att: Attachment) =>
    att.contentType?.startsWith('image/') || false
  );

  // Check for links in content
  const links = message.content.match(URL_PATTERN) || [];
  const slipLink = links.find(link =>
    SLIP_DOMAINS.some(domain => link.toLowerCase().includes(domain))
  ) || links[0] || null;

  return {
    hasLink: links.length > 0,
    hasImage: !!imageAttachment,
    link: slipLink,
    imageUrl: imageAttachment?.url || null,
  };
}

/**
 * Download an image from URL to a temporary file
 */
async function downloadImage(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const tempDir = os.tmpdir();
    const fileName = `twitter_upload_${Date.now()}.png`;
    const filePath = path.join(tempDir, fileName);

    fs.writeFileSync(filePath, response.data);
    return filePath;
  } catch (error) {
    logger.error('Failed to download image', error);
    return null;
  }
}

/**
 * Clean up temporary file
 */
function cleanupTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    logger.warn('Failed to cleanup temp file', error);
  }
}

/**
 * Generate hashtags based on content
 */
function getHashtags(content: string): string {
  const contentLower = content.toLowerCase();

  if (contentLower.includes('nba') || contentLower.includes('points') || contentLower.includes('rebounds')) {
    return '#NBA #NBABets';
  } else if (contentLower.includes('nfl') || contentLower.includes('touchdown')) {
    return '#NFL #NFLBets';
  } else if (contentLower.includes('mlb') || contentLower.includes('runs')) {
    return '#MLB #MLBBets';
  } else if (contentLower.includes('nhl') || contentLower.includes('goals')) {
    return '#NHL #NHLBets';
  }

  return '#SportsBetting #FreePicks';
}

/**
 * Format the full tweet with promo and hashtags
 */
function formatTweet(tweetContent: string, slipLink: string | null, messageContent: string): string {
  const hashtags = getHashtags(messageContent);
  const promo = `More picks: ${config.promo.discordInvite}`;

  let tweet = tweetContent;

  // Add slip link if available
  if (slipLink) {
    tweet += `\n\n${slipLink}`;
  }

  // Add promo and hashtags
  tweet += `\n\n${promo}\n\n${hashtags}`;

  // Trim if over 280 characters
  if (tweet.length > 280) {
    const maxContentLen = 280 - promo.length - hashtags.length - 10;
    tweet = tweetContent.substring(0, maxContentLen) + '...';
    tweet += `\n\n${promo}\n\n${hashtags}`;
  }

  return tweet.substring(0, 280);
}

/**
 * Post a tweet with optional image
 */
export async function postToTwitter(message: Message): Promise<boolean> {
  const client = getTwitterClient();

  if (!client) {
    logger.error('Twitter client not available');
    return false;
  }

  const { link, imageUrl } = hasLinkAndImage(message);
  let tempFilePath: string | null = null;

  try {
    logger.info(`Processing Twitter post for message ${message.id}`);

    // Generate tweet content using Gemini
    let tweetContent = await generateTweetFromSlip(message.content, link);

    // Format the full tweet
    const fullTweet = formatTweet(tweetContent, link, message.content);

    logger.info(`Generated tweet: ${fullTweet}`);

    // Upload image if available
    let mediaId: string | undefined;

    if (imageUrl) {
      logger.info('Downloading image for upload...');
      tempFilePath = await downloadImage(imageUrl);

      if (tempFilePath) {
        logger.info('Uploading image to Twitter...');
        mediaId = await client.v1.uploadMedia(tempFilePath);
        logger.info(`Image uploaded, media ID: ${mediaId}`);
      }
    }

    // Post the tweet
    logger.info('Posting tweet...');

    let result;
    if (mediaId) {
      result = await client.v2.tweet({
        text: fullTweet,
        media: { media_ids: [mediaId] as [string] },
      });
    } else {
      result = await client.v2.tweet(fullTweet);
    }

    logger.info(`Tweet posted successfully! ID: ${result.data.id}`);
    return true;

  } catch (error) {
    logger.error('Error posting to Twitter', error);
    return false;
  } finally {
    // Cleanup temp file
    if (tempFilePath) {
      cleanupTempFile(tempFilePath);
    }
  }
}
