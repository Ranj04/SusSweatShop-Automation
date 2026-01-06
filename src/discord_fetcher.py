"""
Discord Fetcher - Fetches picks from Discord channel using Discord API
"""
import requests
import json
import os
from datetime import datetime, timedelta
from typing import List, Optional, Dict
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.settings import DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID, POSTED_PICKS_FILE


class DiscordFetcher:
    """Fetches picks from a Discord channel"""

    def __init__(self):
        self.token = DISCORD_BOT_TOKEN
        self.channel_id = DISCORD_CHANNEL_ID
        self.base_url = "https://discord.com/api/v10"
        self.headers = {
            "Authorization": f"Bot {self.token}",
            "Content-Type": "application/json"
        }

    def get_recent_messages(self, limit: int = 10) -> List[Dict]:
        """
        Fetch recent messages from the Discord channel

        Args:
            limit: Number of messages to fetch (max 100)

        Returns:
            List of message dictionaries
        """
        url = f"{self.base_url}/channels/{self.channel_id}/messages"
        params = {"limit": min(limit, 100)}

        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error fetching Discord messages: {e}")
            return []

    def extract_picks(self, messages: List[Dict]) -> List[Dict]:
        """
        Extract pick information from messages

        Args:
            messages: List of Discord message objects

        Returns:
            List of pick dictionaries with 'content', 'id', and 'timestamp'
        """
        picks = []

        for msg in messages:
            content = msg.get("content", "").strip()

            # Skip empty messages or bot messages
            if not content or msg.get("author", {}).get("bot", False):
                continue

            # Check if message looks like a pick (contains betting indicators)
            if self._is_valid_pick(content):
                picks.append({
                    "content": content,
                    "id": msg.get("id"),
                    "timestamp": msg.get("timestamp"),
                    "author": msg.get("author", {}).get("username", "Unknown")
                })

        return picks

    def _is_valid_pick(self, content: str) -> bool:
        """
        Check if a message content looks like a sports pick

        Args:
            content: Message content

        Returns:
            True if it appears to be a pick
        """
        content_lower = content.lower()

        # Betting indicators
        betting_keywords = [
            "over", "under", "ml", "moneyline", "+", "-",
            "spread", "pts", "points", "rebounds", "assists",
            "vs", "vs.", "@", "parlay", "straight", "pick"
        ]

        # Check for odds format (e.g., -110, +150, @ -109)
        has_odds = any(
            (f"+{i}" in content or f"-{i}" in content)
            for i in range(100, 500)
        )

        # Check for betting keywords
        has_keyword = any(kw in content_lower for kw in betting_keywords)

        return has_odds or has_keyword

    def get_unposted_picks(self, limit: int = 5) -> List[Dict]:
        """
        Get picks that haven't been posted to Twitter yet

        Args:
            limit: Maximum number of picks to return

        Returns:
            List of unposted pick dictionaries
        """
        # Get recent messages
        messages = self.get_recent_messages(limit=20)
        picks = self.extract_picks(messages)

        # Load posted picks
        posted_ids = self._load_posted_picks()

        # Filter out already posted picks
        unposted = [p for p in picks if p["id"] not in posted_ids]

        return unposted[:limit]

    def _load_posted_picks(self) -> set:
        """Load the set of already posted pick IDs"""
        try:
            if os.path.exists(POSTED_PICKS_FILE):
                with open(POSTED_PICKS_FILE, "r") as f:
                    data = json.load(f)
                    return set(data.get("posted_ids", []))
        except (json.JSONDecodeError, IOError) as e:
            print(f"Error loading posted picks: {e}")
        return set()

    def mark_as_posted(self, pick_id: str) -> None:
        """
        Mark a pick as posted to prevent duplicates

        Args:
            pick_id: Discord message ID of the pick
        """
        posted_ids = list(self._load_posted_picks())
        posted_ids.append(pick_id)

        # Keep only last 100 IDs to prevent file from growing too large
        posted_ids = posted_ids[-100:]

        try:
            with open(POSTED_PICKS_FILE, "w") as f:
                json.dump({
                    "posted_ids": posted_ids,
                    "last_updated": datetime.now().isoformat()
                }, f, indent=2)
        except IOError as e:
            print(f"Error saving posted picks: {e}")


def main():
    """Test the Discord fetcher"""
    fetcher = DiscordFetcher()

    print("Fetching recent messages...")
    messages = fetcher.get_recent_messages(limit=10)
    print(f"Found {len(messages)} messages")

    picks = fetcher.extract_picks(messages)
    print(f"Extracted {len(picks)} picks:")

    for pick in picks:
        print(f"  - {pick['content'][:50]}...")

    unposted = fetcher.get_unposted_picks(limit=3)
    print(f"\nUnposted picks: {len(unposted)}")


if __name__ == "__main__":
    main()
