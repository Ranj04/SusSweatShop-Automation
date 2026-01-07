"""
AI Writer - Generates tweet content using Google Gemini API
"""
import google.generativeai as genai
import os
import random
import sys
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


class AIWriter:
    """Generates tweet content using Gemini AI"""

    def __init__(self):
        genai.configure(api_key=GEMINI_API_KEY)
        self.model = genai.GenerativeModel('gemini-1.5-flash')

    def detect_sport(self, pick: str) -> str:
        """
        Detect which sport the pick is for based on keywords

        Args:
            pick: The pick text

        Returns:
            Sport name (NBA, NFL, MLB, NHL, etc.) or 'default'
        """
        pick_lower = pick.lower()

        for sport, keywords in SPORT_KEYWORDS.items():
            if any(kw in pick_lower for kw in keywords):
                return sport

        return "default"

    def generate_analysis(self, pick: str) -> str:
        """
        Generate an AI analysis for the pick

        Args:
            pick: The sports pick text

        Returns:
            Generated analysis text
        """
        prompt = GEMINI_PROMPT_TEMPLATE.format(pick=pick)

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"Error generating AI content: {e}")
            # Fallback to a simple format
            return self._fallback_analysis(pick)

    def _fallback_analysis(self, pick: str) -> str:
        """
        Generate a simple fallback analysis if AI fails

        Args:
            pick: The sports pick text

        Returns:
            Simple formatted pick text
        """
        hooks = [
            "🔥 LOCK OF THE DAY 🔥",
            "💰 MONEY PLAY 💰",
            "🎯 SHARP ACTION 🎯",
            "⚡ TODAY'S PICK ⚡",
            "🔒 HAMMER THIS 🔒"
        ]
        closers = [
            "Let's eat! 💪",
            "Trust the process 📈",
            "Easy money 💵",
            "Book it! ✅",
            "Fade at your own risk 🎲"
        ]

        return f"{random.choice(hooks)}\n\n{pick}\n\n{random.choice(closers)}"

    def get_hashtags(self, sport: str) -> str:
        """
        Get optimized hashtags for a sport

        Args:
            sport: Sport name

        Returns:
            Hashtag string
        """
        # Get sport-specific hashtags
        sport_tags = HASHTAGS.get(sport, HASHTAGS["default"])

        # Add 1-2 random viral hashtags for variety
        viral_tags = random.sample(VIRAL_HASHTAGS, min(2, len(VIRAL_HASHTAGS)))

        return f"{sport_tags} {' '.join(viral_tags)}"

    def get_promo_text(self) -> str:
        """
        Get promotional text for Discord and website

        Returns:
            Promo string
        """
        promos = [
            f"🎯 More picks: {WEBSITE_URL}\n💬 Join free: {DISCORD_INVITE_LINK}",
            f"📊 Free picks daily: {DISCORD_INVITE_LINK}\n🌐 {WEBSITE_URL}",
            f"💰 Join the winners: {DISCORD_INVITE_LINK}\n🔥 {WEBSITE_URL}",
            f"🏆 Get all our picks FREE\n💬 {DISCORD_INVITE_LINK}\n🌐 {WEBSITE_URL}",
            f"⚡ Never miss a pick!\n📱 {DISCORD_INVITE_LINK}\n🎯 {WEBSITE_URL}",
        ]
        return random.choice(promos)

    def format_tweet(self, pick: str, analysis: str = None) -> str:
        """
        Format the complete tweet with analysis, promo, and hashtags

        Args:
            pick: Original pick text
            analysis: AI-generated analysis (optional)

        Returns:
            Complete formatted tweet optimized for engagement
        """
        # Generate analysis if not provided
        if analysis is None:
            analysis = self.generate_analysis(pick)

        # Detect sport and get hashtags
        sport = self.detect_sport(pick)
        hashtags = self.get_hashtags(sport)

        # Get promo text
        promo = self.get_promo_text()

        # Build the tweet - structure for maximum engagement:
        # 1. Hook/Analysis (catches attention)
        # 2. Promo (Discord + Website)
        # 3. Hashtags (discoverability)

        tweet_parts = [
            analysis,
            "",
            promo,
            "",
            hashtags
        ]

        tweet = "\n".join(tweet_parts)

        # Twitter character limit is 280
        # If too long, trim the analysis
        if len(tweet) > 280:
            tweet = self._trim_tweet(analysis, promo, hashtags)

        return tweet

    def _trim_tweet(self, analysis: str, promo: str, hashtags: str) -> str:
        """
        Trim tweet to fit character limit while keeping essential parts

        Args:
            analysis: The AI analysis
            promo: Promo text
            hashtags: Hashtag string

        Returns:
            Trimmed tweet
        """
        # Calculate available space for analysis
        # Reserve space for promo and hashtags
        promo_len = len(promo)

        # Use shorter hashtags if needed
        short_hashtags = "#SportsBetting #FreePicks #SUSSWEATSHOP"
        hashtag_len = len(short_hashtags)

        # Calculate max analysis length (280 - promo - hashtags - newlines)
        max_analysis_len = 280 - promo_len - hashtag_len - 6  # 6 for newlines

        # Trim analysis if needed
        if len(analysis) > max_analysis_len:
            # Try to cut at a sentence or word boundary
            analysis = analysis[:max_analysis_len]
            if ' ' in analysis:
                analysis = analysis.rsplit(' ', 1)[0]
            if not analysis.endswith(('!', '.', '?')):
                analysis += "..."

        # Use shorter promo if still too long
        short_promo = f"🎯 {DISCORD_INVITE_LINK}"

        tweet = f"{analysis}\n\n{short_promo}\n\n{short_hashtags}"

        if len(tweet) > 280:
            # Last resort - just analysis and short hashtags
            max_len = 280 - len(short_hashtags) - 2
            analysis = analysis[:max_len].rsplit(' ', 1)[0] + "..."
            tweet = f"{analysis}\n\n{short_hashtags}"

        return tweet

    def format_recap_tweet(self, record: str, win_rate: str, performance: str) -> str:
        """
        Format a recap tweet

        Args:
            record: Record string (e.g., "5W-2L-1P")
            win_rate: Win rate percentage
            performance: Performance text

        Returns:
            Formatted recap tweet
        """
        emojis = "🔥" if "winning" in performance.lower() else "📊"

        tweet_parts = [
            f"{emojis} DAILY RECAP {emojis}",
            "",
            f"📊 Record: {record}",
            f"📈 Win Rate: {win_rate}",
            "",
            performance,
            "",
            f"🏆 Join the winners FREE",
            f"💬 {DISCORD_INVITE_LINK}",
            f"🌐 {WEBSITE_URL}",
            "",
            "#SportsBetting #FreePicks #GamblingTwitter #SUSSWEATSHOP #Winners"
        ]

        tweet = "\n".join(tweet_parts)

        # Trim if too long
        if len(tweet) > 280:
            tweet_parts = [
                f"{emojis} DAILY RECAP: {record} ({win_rate}) {emojis}",
                performance,
                "",
                f"🎯 {DISCORD_INVITE_LINK}",
                "",
                "#SportsBetting #FreePicks #SUSSWEATSHOP"
            ]
            tweet = "\n".join(tweet_parts)

        return tweet


def main():
    """Test the AI writer"""
    writer = AIWriter()

    test_picks = [
        "Lakers -3.5 vs Celtics",
        "Tyrese Maxey UNDER 10.5 Rebs + Ast @ -109",
        "Chiefs ML vs Ravens"
    ]

    for pick in test_picks:
        print(f"\n{'='*50}")
        print(f"Pick: {pick}")
        print(f"Detected Sport: {writer.detect_sport(pick)}")
        print(f"\nGenerated Tweet:")
        print("-" * 30)
        tweet = writer.format_tweet(pick)
        print(tweet)
        print(f"\nCharacter count: {len(tweet)}")


if __name__ == "__main__":
    main()
