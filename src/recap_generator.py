"""
Recap Generator - Creates daily recap tweets with bet results
"""
import json
import os
from datetime import datetime
from typing import Dict, List, Optional
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.discord_fetcher import DiscordFetcher
from src.sports_results import SportsResults
from config.settings import DISCORD_INVITE_LINK, WEBSITE_URL, HASHTAGS

DAILY_RESULTS_FILE = "daily_results.json"


class RecapGenerator:
    """Generates daily recap content for Twitter"""

    def __init__(self):
        self.discord = DiscordFetcher()
        self.sports = SportsResults()

    def get_todays_results(self) -> Dict:
        """
        Get today's picks and their results

        Returns:
            Dictionary with picks, results, and stats
        """
        # Get today's picks from Discord
        picks = self.discord.get_todays_picks_for_recap()

        results = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "picks": [],
            "wins": 0,
            "losses": 0,
            "pushes": 0,
            "pending": 0,
            "total_picks": len(picks)
        }

        for pick in picks:
            # Try to grade the pick
            grade = self.sports.grade_pick(pick["content"])

            pick_result = {
                "content": pick["content"],
                "id": pick["id"],
                "timestamp": pick["timestamp"],
                "result": grade["result"],
                "graded": grade["graded"],
                "reason": grade["reason"],
                "confidence": grade["confidence"],
                "image": pick.get("local_image_path"),
                "links": pick.get("links", [])
            }

            results["picks"].append(pick_result)

            # Update counts
            if grade["result"] == "WIN":
                results["wins"] += 1
            elif grade["result"] == "LOSS":
                results["losses"] += 1
            elif grade["result"] == "PUSH":
                results["pushes"] += 1
            else:
                results["pending"] += 1

        # Save results for reference
        self._save_results(results)

        return results

    def _save_results(self, results: Dict) -> None:
        """Save daily results to file"""
        try:
            with open(DAILY_RESULTS_FILE, "w") as f:
                json.dump(results, f, indent=2, default=str)
        except IOError as e:
            print(f"Error saving daily results: {e}")

    def generate_recap_tweet(self, results: Dict = None) -> str:
        """
        Generate a recap tweet based on today's results

        Args:
            results: Results dictionary (will fetch if not provided)

        Returns:
            Tweet text
        """
        if results is None:
            results = self.get_todays_results()

        wins = results["wins"]
        losses = results["losses"]
        pushes = results["pushes"]
        pending = results["pending"]
        total = results["total_picks"]

        # Calculate record string
        if total == 0:
            return self._generate_no_picks_tweet()

        graded_total = wins + losses + pushes

        # Determine emoji based on performance
        if wins > losses:
            performance_emoji = "🔥"
            performance_text = "Another winning day! 💰"
        elif wins == losses:
            performance_emoji = "📊"
            performance_text = "Broke even - back tomorrow 💪"
        else:
            performance_emoji = "📉"
            performance_text = "Bounce back tomorrow 💪"

        # Build record string
        record_parts = []
        if wins > 0:
            record_parts.append(f"{wins}W")
        if losses > 0:
            record_parts.append(f"{losses}L")
        if pushes > 0:
            record_parts.append(f"{pushes}P")

        record_str = "-".join(record_parts) if record_parts else "0-0"

        # Calculate win rate
        if wins + losses > 0:
            win_rate = (wins / (wins + losses)) * 100
            win_rate_str = f"{win_rate:.0f}%"
        else:
            win_rate_str = "N/A"

        # Build the tweet - optimized for engagement
        tweet_lines = [
            f"{performance_emoji} DAILY RECAP {performance_emoji}",
            "",
            f"📊 Record: {record_str}",
            f"📈 Win Rate: {win_rate_str}",
        ]

        # Add pending note if any
        if pending > 0:
            tweet_lines.append(f"⏳ Pending: {pending}")

        tweet_lines.extend([
            "",
            performance_text,
            "",
            f"🏆 FREE picks daily:",
            f"💬 {DISCORD_INVITE_LINK}",
            f"🌐 {WEBSITE_URL}",
            "",
            "#SportsBetting #FreePicks #GamblingTwitter #SUSSWEATSHOP"
        ])

        tweet = "\n".join(tweet_lines)

        # Trim if over 280
        if len(tweet) > 280:
            tweet = self._trim_recap_tweet(record_str, win_rate_str, performance_text, pending)

        return tweet

    def _trim_recap_tweet(self, record: str, win_rate: str, performance: str, pending: int) -> str:
        """Generate a shorter recap tweet if needed"""
        pending_str = f" | {pending} pending" if pending > 0 else ""

        tweet_lines = [
            f"🔥 RECAP: {record} ({win_rate}){pending_str}",
            "",
            performance,
            "",
            f"🎯 {DISCORD_INVITE_LINK}",
            "",
            "#SportsBetting #FreePicks #SUSSWEATSHOP"
        ]

        return "\n".join(tweet_lines)

    def generate_detailed_recap(self, results: Dict = None) -> List[str]:
        """
        Generate a detailed recap thread (multiple tweets)

        Args:
            results: Results dictionary

        Returns:
            List of tweet texts for a thread
        """
        if results is None:
            results = self.get_todays_results()

        tweets = []

        # First tweet - summary
        tweets.append(self.generate_recap_tweet(results))

        # Additional tweets for individual picks (if any graded)
        graded_picks = [p for p in results["picks"] if p["graded"]]

        if graded_picks:
            for i, pick in enumerate(graded_picks[:3]):  # Max 3 picks in thread
                result_emoji = "✅" if pick["result"] == "WIN" else "❌" if pick["result"] == "LOSS" else "➖"

                pick_tweet = f"{result_emoji} {pick['content'][:120]}"
                if len(pick['content']) > 120:
                    pick_tweet += "..."

                pick_tweet += f"\n\nResult: {pick['result']}"
                if pick.get("reason"):
                    pick_tweet += f"\n{pick['reason'][:50]}"

                # Add hashtags to each tweet in thread
                pick_tweet += "\n\n#SportsBetting #FreePicks"

                tweets.append(pick_tweet)

        return tweets

    def _generate_no_picks_tweet(self) -> str:
        """Generate tweet when no picks were made today"""
        return f"""📋 DAILY UPDATE

No official picks today - sometimes patience is the play! 🎯

Back tomorrow with more FREE winners 💪

🏆 Join the community:
💬 {DISCORD_INVITE_LINK}
🌐 {WEBSITE_URL}

#SportsBetting #FreePicks #SUSSWEATSHOP"""

    def get_best_image_for_recap(self, results: Dict = None) -> Optional[str]:
        """
        Get the best image to use for the recap tweet

        Args:
            results: Results dictionary

        Returns:
            Path to image file or None
        """
        if results is None:
            results = self.get_todays_results()

        # Try to find an image from a winning pick first
        for pick in results["picks"]:
            if pick["result"] == "WIN" and pick.get("image"):
                return pick["image"]

        # Fall back to any pick with an image
        for pick in results["picks"]:
            if pick.get("image"):
                return pick["image"]

        return None


def main():
    """Test the recap generator"""
    generator = RecapGenerator()

    print("Fetching today's results...")
    results = generator.get_todays_results()

    print(f"\nDate: {results['date']}")
    print(f"Total picks: {results['total_picks']}")
    print(f"Wins: {results['wins']}")
    print(f"Losses: {results['losses']}")
    print(f"Pushes: {results['pushes']}")
    print(f"Pending: {results['pending']}")

    print("\n" + "="*50)
    print("RECAP TWEET:")
    print("="*50)
    recap = generator.generate_recap_tweet(results)
    print(recap)
    print(f"\nCharacter count: {len(recap)}")

    print("\n" + "="*50)
    print("DETAILED RECAP THREAD:")
    print("="*50)
    for i, tweet in enumerate(generator.generate_detailed_recap(results)):
        print(f"\n--- Tweet {i+1} ---")
        print(tweet)
        print(f"({len(tweet)} chars)")


if __name__ == "__main__":
    main()
