"""
Daily Summary Generator - Creates daily betting summaries for Twitter
Posts at 10 PM with today's action summary or tomorrow's preview
"""
import os
import sys
from datetime import datetime
from typing import Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import google.generativeai as genai
from src.props_fetcher import PropsFetcher
from src.discord_fetcher import DiscordFetcher
from src.twitter_poster import TwitterPoster
from config.settings import GEMINI_API_KEY, DISCORD_INVITE_LINK, WEBSITE_URL


class DailySummaryGenerator:
    """Generates daily summaries for Twitter posting at 10 PM"""

    def __init__(self):
        genai.configure(api_key=GEMINI_API_KEY)
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        self.props_fetcher = PropsFetcher()
        self.discord_fetcher = DiscordFetcher()

    def get_todays_picks_summary(self) -> dict:
        """
        Get a summary of today's picks from Discord

        Returns:
            Dictionary with pick counts and details
        """
        picks = self.discord_fetcher.get_todays_picks_for_recap()

        summary = {
            "total_picks": len(picks),
            "picks": [],
            "sports": set(),
        }

        for pick in picks:
            content = pick.get("content", "")[:100]
            summary["picks"].append(content)

            # Try to detect sport
            content_lower = content.lower()
            if any(kw in content_lower for kw in ["nba", "lakers", "celtics", "points", "rebounds"]):
                summary["sports"].add("NBA")
            elif any(kw in content_lower for kw in ["nfl", "chiefs", "eagles", "touchdown"]):
                summary["sports"].add("NFL")
            elif any(kw in content_lower for kw in ["mlb", "yankees", "dodgers", "runs"]):
                summary["sports"].add("MLB")
            elif any(kw in content_lower for kw in ["nhl", "goals", "bruins"]):
                summary["sports"].add("NHL")

        summary["sports"] = list(summary["sports"]) or ["Mixed"]
        return summary

    def get_popular_props_preview(self) -> dict:
        """
        Get popular props for tomorrow's preview

        Returns:
            Dictionary with prop information
        """
        props = self.props_fetcher.get_todays_popular_props()

        preview = {
            "total_props": len(props),
            "props": [],
            "sports": set(),
        }

        for prop in props[:10]:
            preview["props"].append({
                "player": prop.get("player_name"),
                "stat": prop.get("stat_type"),
                "line": prop.get("line"),
                "sport": prop.get("sport"),
            })
            if prop.get("sport"):
                preview["sports"].add(prop.get("sport"))

        preview["sports"] = list(preview["sports"]) or ["Mixed"]
        return preview

    def generate_summary_tweet(self, include_props_preview: bool = True) -> str:
        """
        Generate a human-like daily summary tweet

        Args:
            include_props_preview: Whether to include upcoming props preview

        Returns:
            Generated tweet text
        """
        # Get today's activity
        picks_summary = self.get_todays_picks_summary()

        # Build context for Gemini
        context_parts = []

        if picks_summary["total_picks"] > 0:
            context_parts.append(f"Posted {picks_summary['total_picks']} picks today")
            context_parts.append(f"Sports covered: {', '.join(picks_summary['sports'])}")
        else:
            context_parts.append("Quiet day, no picks posted")

        # Get props preview if requested
        if include_props_preview:
            props_preview = self.get_popular_props_preview()
            if props_preview["total_props"] > 0:
                context_parts.append(f"\nTomorrow's board has {props_preview['total_props']}+ props")
                # Add a few interesting props
                interesting = props_preview["props"][:3]
                for prop in interesting:
                    context_parts.append(f"  - {prop['player']} {prop['stat']} {prop['line']}")

        context = "\n".join(context_parts)

        prompt = f"""Write a casual end-of-day tweet for a sports betting account (posting at 10 PM).

Context:
{context}

Requirements:
- Sound like a real person wrapping up their day, NOT a bot
- Be brief and conversational (2-3 sentences max)
- If we had picks today, mention how the day went (without specific W-L if not provided)
- If there are interesting props tomorrow, casually mention being ready for tomorrow
- NO excessive emojis (0-1 max)
- NO ALL CAPS or hype words
- NO hashtags
- NO links (those are added separately)
- Be genuine and relatable

Good examples:
"Wrapped up the day. Had some nice action on the NBA slate. Back at it tomorrow with more plays."
"Quiet Monday but the board looks good for tomorrow. NFL Thursday night should be fun."
"Decent day on the props. Got a few more I like for tomorrow - will drop those in the morning."

Bad examples (avoid):
"🔥🔥 WHAT A DAY!! CRUSHED IT!! 🔥🔥"
"RECAP TIME!! WE WENT 5-2!! LET'S GOOO!!"
"""

        try:
            response = self.model.generate_content(prompt)
            tweet = response.text.strip()

            # Clean up any unwanted elements
            tweet = tweet.replace('"', '').strip()

            if len(tweet) < 20:
                return self._fallback_summary(picks_summary)

            return tweet

        except Exception as e:
            print(f"Error generating summary: {e}")
            return self._fallback_summary(picks_summary)

    def _fallback_summary(self, picks_summary: dict) -> str:
        """Generate fallback summary if AI fails"""
        if picks_summary["total_picks"] > 0:
            sports = ", ".join(picks_summary["sports"][:2])
            return f"Wrapped up the day with some {sports} action. More plays coming tomorrow."
        else:
            return "Quiet day today. Scanning the board for tomorrow's plays."

    def format_full_tweet(self, summary: str) -> str:
        """
        Format the full tweet with promo links

        Args:
            summary: The generated summary text

        Returns:
            Complete tweet ready to post
        """
        tweet_parts = [
            summary,
            "",
            f"All picks: {DISCORD_INVITE_LINK}",
            "",
            "#SportsBetting #FreePicks"
        ]

        tweet = "\n".join(tweet_parts)

        # Trim if over 280
        if len(tweet) > 280:
            max_summary = 280 - len(f"\n\n{DISCORD_INVITE_LINK}\n\n#SportsBetting") - 5
            summary = summary[:max_summary] + "..."
            tweet = f"{summary}\n\n{DISCORD_INVITE_LINK}\n\n#SportsBetting"

        return tweet[:280]

    def post_daily_summary(self, dry_run: bool = False) -> bool:
        """
        Generate and post the daily summary to Twitter

        Args:
            dry_run: If True, don't actually post

        Returns:
            True if successful
        """
        print(f"\n{'='*50}")
        print(f"Daily Summary - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*50}")

        # Generate summary
        print("\nGenerating daily summary...")
        summary = self.generate_summary_tweet()
        print(f"Summary: {summary}")

        # Format full tweet
        tweet = self.format_full_tweet(summary)
        print(f"\nFull tweet ({len(tweet)} chars):")
        print("-" * 40)
        print(tweet)
        print("-" * 40)

        if dry_run:
            print("\n[DRY RUN] Would post this tweet")
            return True

        # Post to Twitter
        twitter = TwitterPoster()

        if not twitter.verify_credentials():
            print("ERROR: Twitter authentication failed")
            return False

        result = twitter.post_tweet(tweet)

        if result:
            print(f"SUCCESS! Tweet ID: {result['id']}")
            return True
        else:
            print("FAILED to post tweet")
            return False


def main():
    """Run the daily summary"""
    import argparse

    parser = argparse.ArgumentParser(description='Post daily summary to Twitter')
    parser.add_argument('--dry-run', action='store_true', help='Don\'t actually post')
    args = parser.parse_args()

    generator = DailySummaryGenerator()
    success = generator.post_daily_summary(dry_run=args.dry_run)

    return 0 if success else 1


if __name__ == "__main__":
    exit(main())
