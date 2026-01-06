"""
Main Orchestrator - Coordinates all components to post picks to Twitter
"""
import os
import sys
import argparse
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.discord_fetcher import DiscordFetcher
from src.ai_writer import AIWriter
from src.image_fetcher import ImageFetcher
from src.twitter_poster import TwitterPoster


class SusSweatShopBot:
    """Main bot orchestrator for SUSSWEATSHOP Twitter automation"""

    def __init__(self):
        print("Initializing SUSSWEATSHOP Bot...")
        self.discord = DiscordFetcher()
        self.ai_writer = AIWriter()
        self.image_fetcher = ImageFetcher()
        self.twitter = TwitterPoster()

    def run(self, max_posts: int = 2, dry_run: bool = False) -> int:
        """
        Run the bot to fetch picks and post to Twitter

        Args:
            max_posts: Maximum number of posts to make
            dry_run: If True, don't actually post (for testing)

        Returns:
            Number of successful posts
        """
        print(f"\n{'='*50}")
        print(f"SUSSWEATSHOP Bot - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*50}")

        # Verify Twitter credentials first
        if not dry_run:
            print("\nVerifying Twitter credentials...")
            if not self.twitter.verify_credentials():
                print("ERROR: Twitter authentication failed!")
                return 0

        # Fetch unposted picks from Discord
        print(f"\nFetching unposted picks from Discord...")
        picks = self.discord.get_unposted_picks(limit=max_posts)

        if not picks:
            print("No new picks found in Discord channel.")
            return 0

        print(f"Found {len(picks)} unposted pick(s)")

        successful_posts = 0

        for i, pick in enumerate(picks[:max_posts], 1):
            print(f"\n--- Processing Pick {i}/{min(len(picks), max_posts)} ---")
            print(f"Pick: {pick['content'][:100]}...")

            try:
                # Generate AI analysis
                print("Generating AI analysis...")
                tweet_text = self.ai_writer.format_tweet(pick['content'])
                print(f"Tweet length: {len(tweet_text)} characters")

                # Get image
                print("Fetching image...")
                image_path = self.image_fetcher.get_image_for_pick(pick['content'])
                if image_path:
                    print(f"Image downloaded: {image_path}")
                else:
                    print("No image available, posting without image")

                if dry_run:
                    print("\n[DRY RUN] Would post tweet:")
                    print("-" * 40)
                    print(tweet_text)
                    print("-" * 40)
                    print(f"Image: {image_path}")
                    successful_posts += 1
                else:
                    # Post to Twitter
                    print("Posting to Twitter...")
                    result = self.twitter.post_tweet(tweet_text, image_path)

                    if result:
                        print(f"SUCCESS! Tweet ID: {result['id']}")
                        # Mark as posted to prevent duplicates
                        self.discord.mark_as_posted(pick['id'])
                        successful_posts += 1
                    else:
                        print("FAILED to post tweet")

            except Exception as e:
                print(f"ERROR processing pick: {e}")
                import traceback
                traceback.print_exc()

        # Cleanup
        print("\nCleaning up temporary files...")
        self.image_fetcher.cleanup()

        print(f"\n{'='*50}")
        print(f"Complete! Posted {successful_posts}/{min(len(picks), max_posts)} picks")
        print(f"{'='*50}")

        return successful_posts


def get_time_slot() -> str:
    """
    Determine current time slot for logging

    Returns:
        Time slot string (morning, midday, evening)
    """
    hour = datetime.now().hour

    if 8 <= hour < 11:
        return "morning"
    elif 11 <= hour < 14:
        return "midday"
    elif 16 <= hour < 19:
        return "evening"
    else:
        return "off-hours"


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='SUSSWEATSHOP Twitter Bot')
    parser.add_argument(
        '--max-posts',
        type=int,
        default=2,
        help='Maximum number of posts to make (default: 2)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Run without actually posting (for testing)'
    )
    parser.add_argument(
        '--verify-only',
        action='store_true',
        help='Only verify credentials, don\'t post'
    )

    args = parser.parse_args()

    print(f"Time slot: {get_time_slot()}")
    print(f"Max posts: {args.max_posts}")
    print(f"Dry run: {args.dry_run}")

    if args.verify_only:
        print("\n--- Verification Mode ---")
        bot = SusSweatShopBot()

        print("\nVerifying Twitter credentials...")
        if bot.twitter.verify_credentials():
            print("Twitter: OK")
        else:
            print("Twitter: FAILED")
            return 1

        print("\nFetching Discord messages...")
        messages = bot.discord.get_recent_messages(limit=5)
        if messages:
            print(f"Discord: OK ({len(messages)} messages)")
            picks = bot.discord.extract_picks(messages)
            print(f"  Picks found: {len(picks)}")
        else:
            print("Discord: FAILED or empty")

        print("\nTesting Gemini AI...")
        try:
            test = bot.ai_writer.generate_analysis("Lakers -3.5 vs Celtics")
            if test:
                print("Gemini: OK")
            else:
                print("Gemini: FAILED")
        except Exception as e:
            print(f"Gemini: FAILED ({e})")

        return 0

    # Run the bot
    bot = SusSweatShopBot()
    successful = bot.run(max_posts=args.max_posts, dry_run=args.dry_run)

    # Return non-zero exit code if no posts were made (for CI/CD)
    return 0 if successful > 0 or args.dry_run else 1


if __name__ == "__main__":
    exit(main())
