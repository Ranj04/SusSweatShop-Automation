"""
AI Writer - Generates tweet content using Google Gemini API
Supports vision analysis of betting slip screenshots
"""
import google.generativeai as genai
import os
import random
import re
import sys
from PIL import Image
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.settings import (
    GEMINI_API_KEY,
    GEMINI_PROMPT_TEMPLATE,
    HASHTAGS,
    VIRAL_HASHTAGS,
    SPORT_KEYWORDS,
    DISCORD_INVITE_LINK,
    WEBSITE_URL
)


# Prompt for analyzing betting slip images
SLIP_ANALYSIS_PROMPT = """Analyze this betting slip screenshot and extract the pick details.

Return ONLY the following information in this exact format:
SPORT: [NBA/NFL/MLB/NHL/NCAAB/NCAAF/UFC/SOCCER]
PLAYER: [Player name if prop bet, or "N/A" if team bet]
TEAM: [Team name(s) involved]
BET_TYPE: [Over/Under/Moneyline/Spread/Parlay]
LINE: [The betting line, e.g., "OVER 25.5 Points" or "Lakers -3.5" or "Chiefs ML"]
ODDS: [The odds if visible, e.g., "-110" or "+150"]

Be concise and accurate. If multiple legs in a parlay, list the main one or summarize as "X-leg parlay".
"""

TWEET_FROM_SLIP_PROMPT = """Write a short, casual sports betting tweet about this pick:

{slip_info}

IMPORTANT - Sound like a real person, NOT a bot:
- Write like you're texting a friend about a bet you like
- NO excessive emojis (1-2 max, or none)
- NO ALL CAPS words like "LOCK" "HAMMER" "SMASH" "FIRE"
- NO cliche phrases like "trust the process" or "let's eat"
- Be conversational and natural
- Include the pick details naturally
- Keep it brief (2-3 sentences max)
- DO NOT include hashtags or links

Good examples (natural, human):
"Really like Tatum over 27.5 tonight. He's been cooking lately and the Nets can't guard anyone."

"Taking the Chiefs -3 here. Mahomes at home in primetime is just different."

"Jokic triple double feels like free money at +180. He's averaging one per game this month."

Bad examples (bot-like, avoid these):
"🔥🔥 LOCK OF THE DAY 🔥🔥 HAMMER THIS NOW!!!"
"💰 SHARP MONEY ALERT 💰 Trust the process!"
"""


class AIWriter:
    """Generates tweet content using Gemini AI with vision support"""

    def __init__(self):
        genai.configure(api_key=GEMINI_API_KEY)
        self.model = genai.GenerativeModel('gemini-1.5-flash')

    def analyze_slip_image(self, image_path: str) -> dict:
        """
        Analyze a betting slip screenshot using Gemini Vision

        Args:
            image_path: Path to the slip screenshot

        Returns:
            Dictionary with extracted pick details
        """
        try:
            # Load the image
            image = Image.open(image_path)

            # Send to Gemini for analysis
            response = self.model.generate_content([SLIP_ANALYSIS_PROMPT, image])
            result = response.text.strip()

            # Parse the response
            slip_info = {
                "sport": "default",
                "player": None,
                "team": None,
                "bet_type": None,
                "line": None,
                "odds": None,
                "raw": result
            }

            for line in result.split('\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    key = key.strip().lower()
                    value = value.strip()

                    if key == "sport":
                        slip_info["sport"] = value.upper() if value.upper() in SPORT_KEYWORDS else "default"
                    elif key == "player":
                        slip_info["player"] = value if value != "N/A" else None
                    elif key == "team":
                        slip_info["team"] = value
                    elif key == "bet_type":
                        slip_info["bet_type"] = value
                    elif key == "line":
                        slip_info["line"] = value
                    elif key == "odds":
                        slip_info["odds"] = value

            print(f"Slip analysis: {slip_info}")
            return slip_info

        except Exception as e:
            print(f"Error analyzing slip image: {e}")
            return {"sport": "default", "raw": str(e)}

    def generate_tweet_from_slip(self, slip_info: dict) -> str:
        """
        Generate a tweet based on analyzed slip info

        Args:
            slip_info: Dictionary from analyze_slip_image

        Returns:
            Generated tweet text (without hashtags/links)
        """
        # Build a summary of the slip for the prompt
        summary_parts = []

        if slip_info.get("player"):
            summary_parts.append(f"Player: {slip_info['player']}")
        if slip_info.get("team"):
            summary_parts.append(f"Team: {slip_info['team']}")
        if slip_info.get("bet_type"):
            summary_parts.append(f"Bet Type: {slip_info['bet_type']}")
        if slip_info.get("line"):
            summary_parts.append(f"Line: {slip_info['line']}")
        if slip_info.get("odds"):
            summary_parts.append(f"Odds: {slip_info['odds']}")
        if slip_info.get("sport"):
            summary_parts.append(f"Sport: {slip_info['sport']}")

        slip_summary = "\n".join(summary_parts) if summary_parts else slip_info.get("raw", "Sports bet")

        prompt = TWEET_FROM_SLIP_PROMPT.format(slip_info=slip_summary)

        try:
            response = self.model.generate_content(prompt)
            result = response.text.strip()

            # Clean up any hashtags or links that slipped through
            result = re.sub(r'#\w+', '', result)
            result = re.sub(r'https?://\S+', '', result)
            result = ' '.join(result.split())  # Clean whitespace

            if len(result) < 20:
                return self._fallback_from_slip(slip_info)

            return result

        except Exception as e:
            print(f"Error generating tweet from slip: {e}")
            return self._fallback_from_slip(slip_info)

    def _fallback_from_slip(self, slip_info: dict) -> str:
        """Generate fallback tweet from slip info - human-like, casual tone"""
        openers = [
            "Really like",
            "Going with",
            "Taking",
            "Feeling good about",
            "Riding with",
        ]
        closers = [
            "Let's see how it plays out.",
            "Like the value here.",
            "Numbers look good on this one.",
            "Feeling confident about this.",
            "",  # Sometimes no closer is more natural
        ]

        # Build pick description
        pick_parts = []
        if slip_info.get("player"):
            pick_parts.append(slip_info["player"])
        if slip_info.get("line"):
            pick_parts.append(slip_info["line"])
        elif slip_info.get("team"):
            pick_parts.append(slip_info["team"])

        pick_text = " ".join(pick_parts) if pick_parts else "this play"

        opener = random.choice(openers)
        closer = random.choice(closers)

        if closer:
            return f"{opener} {pick_text}. {closer}"
        else:
            return f"{opener} {pick_text} tonight."

    def detect_sport(self, pick: str) -> str:
        """Detect which sport the pick is for based on keywords"""
        pick_lower = pick.lower()

        for sport, keywords in SPORT_KEYWORDS.items():
            if any(kw in pick_lower for kw in keywords):
                return sport

        return "default"

    def clean_pick_content(self, pick: str) -> str:
        """Clean pick content by removing URLs and extra whitespace"""
        pick = re.sub(r'https?://\S+', '', pick)
        pick = ' '.join(pick.split())
        return pick.strip()

    def generate_analysis(self, pick: str) -> str:
        """Generate an AI analysis for a text-based pick"""
        clean_pick = self.clean_pick_content(pick)

        if len(clean_pick) < 10:
            return self._fallback_analysis(pick)

        prompt = GEMINI_PROMPT_TEMPLATE.format(pick=clean_pick)

        try:
            response = self.model.generate_content(prompt)
            result = response.text.strip()

            if len(result) < 20:
                return self._fallback_analysis(pick)

            return result
        except Exception as e:
            print(f"Error generating AI content: {e}")
            return self._fallback_analysis(pick)

    def _fallback_analysis(self, pick: str) -> str:
        """Generate a simple fallback analysis if AI fails - human-like tone"""
        clean_pick = self.clean_pick_content(pick)

        openers = [
            "Like this one today -",
            "Going with",
            "Taking",
            "Playing",
            "Riding",
        ]
        closers = [
            "Let's see how it goes.",
            "Like what I'm seeing here.",
            "Good spot for this.",
            "Value looks right.",
            "",
        ]

        opener = random.choice(openers)
        closer = random.choice(closers)

        if clean_pick and len(clean_pick) > 5:
            if closer:
                return f"{opener} {clean_pick}. {closer}"
            else:
                return f"{opener} {clean_pick}."
        else:
            return "Got one I like today. Check out the slip."

    def get_hashtags(self, sport: str) -> str:
        """Get hashtags for a sport - fewer tags looks more natural"""
        sport_tags = HASHTAGS.get(sport, HASHTAGS["default"]).split()

        # Use only 2-3 hashtags max to look more human
        selected_tags = sport_tags[:2]

        # Sometimes add one viral hashtag
        if random.random() > 0.5 and VIRAL_HASHTAGS:
            viral_tag = random.choice(VIRAL_HASHTAGS)
            if viral_tag.lower() not in [t.lower() for t in selected_tags]:
                selected_tags.append(viral_tag)

        return ' '.join(selected_tags[:3])

    def get_promo_text(self) -> str:
        """Get promotional text for Discord and website - cleaner, less spammy"""
        promos = [
            f"More picks: {DISCORD_INVITE_LINK}",
            f"Free daily picks: {DISCORD_INVITE_LINK}",
            f"Join for more: {DISCORD_INVITE_LINK}",
            f"{WEBSITE_URL}",
            f"All picks: {DISCORD_INVITE_LINK}",
        ]
        return random.choice(promos)

    def format_tweet(self, pick: str = None, analysis: str = None, slip_link: str = None,
                     slip_image_path: str = None, slip_info: dict = None) -> str:
        """
        Format the complete tweet with analysis, promo, and hashtags

        Args:
            pick: Original pick text (optional if using image)
            analysis: Pre-generated analysis (optional)
            slip_link: PrizePicks or betting slip link (optional)
            slip_image_path: Path to slip screenshot for vision analysis (optional)
            slip_info: Pre-analyzed slip info (optional)

        Returns:
            Complete formatted tweet optimized for engagement
        """
        sport = "default"

        # If we have a slip image, analyze it
        if slip_image_path and not slip_info:
            print("Analyzing slip image with Gemini Vision...")
            slip_info = self.analyze_slip_image(slip_image_path)

        # Generate analysis based on available info
        if slip_info:
            # Use slip analysis to generate tweet
            if not analysis:
                analysis = self.generate_tweet_from_slip(slip_info)
            sport = slip_info.get("sport", "default")
        elif pick and not analysis:
            # Fall back to text-based analysis
            analysis = self.generate_analysis(pick)
            sport = self.detect_sport(pick)
        elif not analysis:
            # Nothing to work with - keep it simple and human
            analysis = "Got one I like today. Check out the slip."

        # Get hashtags and promo
        hashtags = self.get_hashtags(sport)
        promo = self.get_promo_text()

        # Build tweet parts
        tweet_parts = [analysis]

        if slip_link:
            tweet_parts.append("")
            tweet_parts.append(f"🎟️ {slip_link}")

        tweet_parts.extend(["", promo, "", hashtags])

        tweet = "\n".join(tweet_parts)

        # Trim if over 280 characters
        if len(tweet) > 280:
            tweet = self._trim_tweet(analysis, promo, hashtags, slip_link)

        return tweet

    def _trim_tweet(self, analysis: str, promo: str, hashtags: str, slip_link: str = None) -> str:
        """Trim tweet to fit character limit"""
        short_hashtags = "#SportsBetting #FreePicks"
        short_promo = f"{DISCORD_INVITE_LINK}"

        reserved = len(short_promo) + len(short_hashtags) + 6
        if slip_link:
            reserved += len(slip_link) + 5

        max_analysis_len = 280 - reserved

        if len(analysis) > max_analysis_len:
            analysis = analysis[:max_analysis_len]
            if ' ' in analysis:
                analysis = analysis.rsplit(' ', 1)[0]
            if not analysis.endswith(('!', '.', '?')):
                analysis += "..."

        if slip_link:
            tweet = f"{analysis}\n\n{slip_link}\n\n{short_promo}\n\n{short_hashtags}"
        else:
            tweet = f"{analysis}\n\n{short_promo}\n\n{short_hashtags}"

        if len(tweet) > 280:
            tweet = f"{analysis[:150]}...\n\n{short_promo}\n\n{short_hashtags}"

        return tweet[:280]

    def format_recap_tweet(self, record: str, win_rate: str, performance: str) -> str:
        """Format a recap tweet - natural, human-like tone"""
        # Determine tone based on performance
        is_winning = "winning" in performance.lower() or "win" in performance.lower()

        if is_winning:
            openers = [
                f"Solid day - went {record}.",
                f"Good one today, {record}.",
                f"Nice day at {record}.",
            ]
        else:
            openers = [
                f"Tough day - {record}.",
                f"Went {record} today.",
                f"Not our day, {record}.",
            ]

        opener = random.choice(openers)

        tweet_parts = [
            opener,
            "",
            performance,
            "",
            f"More picks: {DISCORD_INVITE_LINK}",
            "",
            "#SportsBetting #FreePicks"
        ]

        tweet = "\n".join(tweet_parts)

        if len(tweet) > 280:
            tweet_parts = [
                f"{opener} {performance}",
                "",
                f"{DISCORD_INVITE_LINK}",
            ]
            tweet = "\n".join(tweet_parts)

        return tweet


def main():
    """Test the AI writer"""
    writer = AIWriter()

    # Test with text picks
    test_picks = [
        "Lakers -3.5 vs Celtics",
        "Tyrese Maxey UNDER 10.5 Rebs + Ast @ -109",
    ]

    for pick in test_picks:
        print(f"\n{'='*50}")
        print(f"Pick: {pick}")
        tweet = writer.format_tweet(pick=pick)
        print(f"Tweet ({len(tweet)} chars):")
        print(tweet)


if __name__ == "__main__":
    main()
