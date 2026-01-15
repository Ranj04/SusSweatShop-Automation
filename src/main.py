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
from src.recap_generator import RecapGenerator
from src.daily_summary import DailySummaryGenerator


class SusSweatShopBot:
    """Main bot orchestrator for SUSSWEATSHOP Twitter automation"""

    def __init__(self):
        print("Initializing SUSSWEATSHOP Bot...")
        self.discord = DiscordFetcher()
        self.ai_writer = AIWriter()
        self.image_fetcher = ImageFetcher()
        self.twitter = TwitterPoster()
        self.recap = RecapGenerator()
        self.daily_summary = DailySummaryGenerator()

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
                # Extract slip link (PrizePicks, Underdog, etc.)
                slip_link = None
                slip_domains = ['prizepicks', 'underdogfantasy', 'sleeper', 'betslip']
                for link in pick.get("links", []):
                    if any(domain in link.lower() for domain in slip_domains):
                        slip_link = link
                        break

                # Determine image to use (slip screenshot)
                image_path = None
                slip_info = None

                # First, try to use image from Discord message (actual attachments only)
                if pick.get("local_image_path"):
                    # Check if it's an actual attachment, not an embed preview
                    if pick.get("images") and any(img.get("filename") and not img.get("filename").startswith("embed") for img in pick["images"]):
                        print(f"Using Discord slip image: {pick['local_image_path']}")
                        image_path = pick["local_image_path"]

                        # Analyze the slip image with Gemini Vision
                        print("Analyzing slip image with Gemini Vision...")
                        slip_info = self.ai_writer.analyze_slip_image(image_path)
                        if slip_info and slip_info.get("player") or slip_info.get("line"):
                            print(f"Extracted from slip: {slip_info.get('player', 'N/A')} - {slip_info.get('line', 'N/A')}")
                    else:
                        print("Skipping embed preview image")

                # Fall back to fetching a relevant image if no attachment
                if not image_path:
                    print("No Discord attachment, fetching relevant image...")
                    image_path = self.image_fetcher.get_image_for_pick(pick['content'])

                # Generate AI analysis - use slip_info if we analyzed an image
                print("Generating AI tweet...")
                if slip_info:
                    tweet_text = self.ai_writer.format_tweet(
                        pick=pick['content'],
                        slip_link=slip_link,
                        slip_info=slip_info
                    )
                else:
                    tweet_text = self.ai_writer.format_tweet(pick['content'], slip_link=slip_link)
                print(f"Tweet length: {len(tweet_text)} characters")

                if image_path:
                    print(f"Image ready: {image_path}")
                else:
                    print("No image available, posting without image")

                if dry_run:
                    print("\n[DRY RUN] Would post tweet:")
                    print("-" * 40)
                    print(tweet_text)
                    print("-" * 40)
                    print(f"Image: {image_path}")
                    print(f"Links from Discord: {pick.get('links', [])}")
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

    def run_recap(self, dry_run: bool = False) -> int:
        """
        Run the daily recap posting

        Args:
            dry_run: If True, don't actually post (for testing)

        Returns:
            1 if successful, 0 if failed
        """
        print(f"\n{'='*50}")
        print(f"SUSSWEATSHOP Daily Recap - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*50}")

        # Verify Twitter credentials first
        if not dry_run:
            print("\nVerifying Twitter credentials...")
            if not self.twitter.verify_credentials():
                print("ERROR: Twitter authentication failed!")
                return 0

        try:
            # Get today's results
            print("\nFetching today's picks and results...")
            results = self.recap.get_todays_results()

            print(f"Found {results['total_picks']} picks from today")
            print(f"  Wins: {results['wins']}")
            print(f"  Losses: {results['losses']}")
            print(f"  Pushes: {results['pushes']}")
            print(f"  Pending: {results['pending']}")

            # Generate recap tweet
            print("\nGenerating recap tweet...")
            tweet_text = self.recap.generate_recap_tweet(results)
            print(f"Tweet length: {len(tweet_text)} characters")

            # Get best image for recap
            image_path = self.recap.get_best_image_for_recap(results)
            if image_path:
                print(f"Using image: {image_path}")
            else:
                # Try to get a generic sports image
                print("No pick image available, using generic image")
                image_path = self.image_fetcher.get_image_for_pick("sports betting recap")

            if dry_run:
                print("\n[DRY RUN] Would post recap tweet:")
                print("-" * 40)
                print(tweet_text)
                print("-" * 40)
                print(f"Image: {image_path}")

                # Show what a thread would look like
                print("\n[DRY RUN] Full thread would be:")
                for i, t in enumerate(self.recap.generate_detailed_recap(results)):
                    print(f"\n--- Tweet {i+1} ---")
                    print(t)

                return 1
            else:
                # Post recap to Twitter
                print("\nPosting recap to Twitter...")
                result = self.twitter.post_tweet(tweet_text, image_path)

                if result:
                    print(f"SUCCESS! Recap tweet ID: {result['id']}")
                    return 1
                else:
                    print("FAILED to post recap tweet")
                    return 0

        except Exception as e:
            print(f"ERROR running recap: {e}")
            import traceback
            traceback.print_exc()
            return 0

        finally:
            # Cleanup
            print("\nCleaning up temporary files...")
            self.image_fetcher.cleanup()

    def run_daily_summary(self, dry_run: bool = False) -> int:
        """
        Run the 10 PM daily summary posting

        Args:
            dry_run: If True, don't actually post (for testing)

        Returns:
            1 if successful, 0 if failed
        """
        print(f"\n{'='*50}")
        print(f"SUSSWEATSHOP Daily Summary - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*50}")

        try:
            success = self.daily_summary.post_daily_summary(dry_run=dry_run)
            return 1 if success else 0

        except Exception as e:
            print(f"ERROR running daily summary: {e}")
            import traceback
            traceback.print_exc()
            return 0


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
    parser.add_argument(
        '--recap',
        action='store_true',
        help='Run daily recap instead of regular posts'
    )
    parser.add_argument(
        '--daily-summary',
        action='store_true',
        help='Run 10 PM daily summary (end of day wrap-up)'
    )

    args = parser.parse_args()

    mode = "Daily Summary" if args.daily_summary else ("Recap" if args.recap else "Regular Posts")
    print(f"Mode: {mode}")
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
            for pick in picks[:2]:
                print(f"    - {pick['content'][:50]}...")
                print(f"      Images: {len(pick.get('images', []))}, Links: {len(pick.get('links', []))}")
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

    if args.daily_summary:
        successful = bot.run_daily_summary(dry_run=args.dry_run)
    elif args.recap:
        successful = bot.run_recap(dry_run=args.dry_run)
    else:
        successful = bot.run(max_posts=args.max_posts, dry_run=args.dry_run)

    # Return non-zero exit code if no posts were made (for CI/CD)
    return 0 if successful > 0 or args.dry_run else 1


if __name__ == "__main__":
    exit(main())
