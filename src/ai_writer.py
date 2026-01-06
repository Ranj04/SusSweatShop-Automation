"""
AI Writer - Generates tweet content using Google Gemini API
"""
import google.generativeai as genai
import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.settings import (
    GEMINI_API_KEY,
    GEMINI_PROMPT_TEMPLATE,
    HASHTAGS,
    SPORT_KEYWORDS,
    DISCORD_INVITE_LINK
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
            Sport name (NBA, NFL, MLB, NHL) or 'default'
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
        return f"Today's Pick:\n\n{pick}\n\nLet's get this bread!"

    def format_tweet(self, pick: str, analysis: str = None) -> str:
        """
        Format the complete tweet with analysis, hashtags, and discord link

        Args:
            pick: Original pick text
            analysis: AI-generated analysis (optional)

        Returns:
            Complete formatted tweet
        """
        # Generate analysis if not provided
        if analysis is None:
            analysis = self.generate_analysis(pick)

        # Detect sport and get hashtags
        sport = self.detect_sport(pick)
        sport_hashtags = HASHTAGS.get(sport, "")
        default_hashtags = HASHTAGS["default"]

        # Build the tweet
        tweet_parts = [
            analysis,
            "",
            f"Join free: {DISCORD_INVITE_LINK}",
            "",
            f"{sport_hashtags} {default_hashtags}".strip()
        ]

        tweet = "\n".join(tweet_parts)

        # Twitter character limit is 280, but we're posting with image
        # so we have more flexibility. Still, trim if too long
        if len(tweet) > 280:
            # Try to keep essential parts
            tweet = self._trim_tweet(analysis, sport, sport_hashtags, default_hashtags)

        return tweet

    def _trim_tweet(self, analysis: str, sport: str, sport_hashtags: str, default_hashtags: str) -> str:
        """
        Trim tweet to fit character limit while keeping essential parts

        Args:
            analysis: The AI analysis
            sport: Detected sport
            sport_hashtags: Sport-specific hashtags
            default_hashtags: Default hashtags

        Returns:
            Trimmed tweet
        """
        # Keep the first part of analysis
        max_analysis_len = 200
        if len(analysis) > max_analysis_len:
            analysis = analysis[:max_analysis_len].rsplit(' ', 1)[0] + "..."

        tweet_parts = [
            analysis,
            "",
            f"Join: {DISCORD_INVITE_LINK}",
            "",
            f"{sport_hashtags} {default_hashtags}".strip()
        ]

        return "\n".join(tweet_parts)


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
