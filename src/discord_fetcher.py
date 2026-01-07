"""
Discord Fetcher - Fetches picks from Discord channel using Discord API
"""
import requests
import json
import os
import re
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
        self.temp_dir = "temp_images"
        os.makedirs(self.temp_dir, exist_ok=True)

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

    def get_todays_messages(self) -> List[Dict]:
        """
        Fetch messages from today (PST timezone)

        Returns:
            List of message dictionaries from today
        """
        messages = self.get_recent_messages(limit=50)
        today = datetime.utcnow().date()

        todays_messages = []
        for msg in messages:
            timestamp = msg.get("timestamp", "")
            if timestamp:
                msg_date = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).date()
                if msg_date == today:
                    todays_messages.append(msg)

        return todays_messages

    def extract_picks(self, messages: List[Dict]) -> List[Dict]:
        """
        Extract pick information from messages including images and links

        Args:
            messages: List of Discord message objects

        Returns:
            List of pick dictionaries with content, id, timestamp, images, and links
        """
        picks = []

        for msg in messages:
            content = msg.get("content", "").strip()

            # Skip empty messages or bot messages
            if not content or msg.get("author", {}).get("bot", False):
                continue

            # Check if message looks like a pick (contains betting indicators)
            if self._is_valid_pick(content):
                pick = {
                    "content": content,
                    "id": msg.get("id"),
                    "timestamp": msg.get("timestamp"),
                    "author": msg.get("author", {}).get("username", "Unknown"),
                    "images": [],
                    "links": [],
                    "embeds": []
                }

                # Extract attachments (images)
                attachments = msg.get("attachments", [])
                for attachment in attachments:
                    if attachment.get("content_type", "").startswith("image/"):
                        pick["images"].append({
                            "url": attachment.get("url"),
                            "filename": attachment.get("filename"),
                            "proxy_url": attachment.get("proxy_url")
                        })

                # Extract embeds (may contain images)
                embeds = msg.get("embeds", [])
                for embed in embeds:
                    embed_data = {
                        "title": embed.get("title"),
                        "description": embed.get("description"),
                        "url": embed.get("url")
                    }
                    if embed.get("image"):
                        embed_data["image_url"] = embed["image"].get("url")
                        pick["images"].append({
                            "url": embed["image"].get("url"),
                            "filename": "embed_image.png",
                            "proxy_url": embed["image"].get("proxy_url")
                        })
                    if embed.get("thumbnail"):
                        embed_data["thumbnail_url"] = embed["thumbnail"].get("url")
                    pick["embeds"].append(embed_data)

                # Extract URLs from content
                url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
                urls = re.findall(url_pattern, content)
                pick["links"] = urls

                picks.append(pick)

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
            "vs", "vs.", "@", "parlay", "straight", "pick",
            "lock", "potd", "play", "bet", "unit", "units"
        ]

        # Check for odds format (e.g., -110, +150, @ -109)
        has_odds = any(
            (f"+{i}" in content or f"-{i}" in content)
            for i in range(100, 500)
        )

        # Check for betting keywords
        has_keyword = any(kw in content_lower for kw in betting_keywords)

        return has_odds or has_keyword

    def download_image(self, url: str, filename: str = None) -> Optional[str]:
        """
        Download an image from Discord CDN

        Args:
            url: Image URL
            filename: Local filename (optional)

        Returns:
            Local file path or None if download failed
        """
        if not url:
            return None

        if not filename:
            filename = f"discord_image_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"

        filepath = os.path.join(self.temp_dir, filename)

        try:
            response = requests.get(url, headers={"User-Agent": "DiscordBot"}, timeout=15)
            response.raise_for_status()

            with open(filepath, 'wb') as f:
                f.write(response.content)

            return filepath
        except requests.RequestException as e:
            print(f"Error downloading image from Discord: {e}")
            return None

    def get_pick_with_image(self, pick: Dict) -> Dict:
        """
        Get a pick with its image downloaded locally

        Args:
            pick: Pick dictionary

        Returns:
            Pick dictionary with local_image_path added
        """
        pick["local_image_path"] = None

        # Try to download the first available image
        if pick.get("images"):
            for img in pick["images"]:
                url = img.get("proxy_url") or img.get("url")
                if url:
                    local_path = self.download_image(url, img.get("filename"))
                    if local_path:
                        pick["local_image_path"] = local_path
                        break

        return pick

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

        # Download images for unposted picks
        for pick in unposted[:limit]:
            self.get_pick_with_image(pick)

        return unposted[:limit]

    def get_todays_picks_for_recap(self) -> List[Dict]:
        """
        Get all picks from today for the daily recap

        Returns:
            List of today's picks with full data
        """
        messages = self.get_todays_messages()
        picks = self.extract_picks(messages)

        # Load posted picks to get the ones we've already tweeted
        posted_ids = self._load_posted_picks()

        # Mark which picks were posted
        for pick in picks:
            pick["was_posted"] = pick["id"] in posted_ids
            self.get_pick_with_image(pick)

        return picks

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
        print(f"\n  - Content: {pick['content'][:50]}...")
        print(f"    Images: {len(pick['images'])}")
        print(f"    Links: {pick['links']}")

    unposted = fetcher.get_unposted_picks(limit=3)
    print(f"\nUnposted picks: {len(unposted)}")


if __name__ == "__main__":
    main()
