"""
Configuration settings for SUSSWEATSHOP Twitter Automation Bot
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Twitter API Credentials
TWITTER_API_KEY = os.getenv("TWITTER_API_KEY")
TWITTER_API_SECRET = os.getenv("TWITTER_API_SECRET")
TWITTER_ACCESS_TOKEN = os.getenv("TWITTER_ACCESS_TOKEN")
TWITTER_ACCESS_TOKEN_SECRET = os.getenv("TWITTER_ACCESS_TOKEN_SECRET")

# Discord Configuration
DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN")
DISCORD_CHANNEL_ID = 1457600194672726220  # Your picks channel

# Gemini AI Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Bot Settings
DISCORD_INVITE_LINK = "discord.gg/ZNwbqrCGqN"
TWITTER_HANDLE = "@SusSweatShop"

# Hashtags by sport
HASHTAGS = {
    "NBA": "#NBA #NBABets #NBATwitter",
    "NFL": "#NFL #NFLBets #NFLTwitter",
    "MLB": "#MLB #MLBBets #MLBTwitter",
    "NHL": "#NHL #NHLBets #NHLTwitter",
    "default": "#SportsBetting #FreePicks #GamblingTwitter #SUSSWEATSHOP"
}

# File to track posted picks (prevents duplicates)
POSTED_PICKS_FILE = "posted_picks.json"

# Gemini prompt template
GEMINI_PROMPT_TEMPLATE = """Generate a sports betting analysis tweet for this pick: {pick}

Requirements:
- Start with a hook using emojis (like fire, chart emojis)
- Include 3-4 relevant stats, trends, or analysis points
- Each stat on its own line with an emoji prefix
- Mention any risk factors with warning emoji
- Sound confident but analytical
- Use emojis strategically: fire, chart_down, chart_up, warning, shield, calendar, etc.
- Keep main analysis under 200 characters per point
- Make it feel like insider knowledge

Format example:
[Hook with pick and emojis]

[Stat 1 with emoji]
[Stat 2 with emoji]
[Stat 3 with emoji]
[Risk factor with warning emoji]

Do NOT include hashtags or the discord link - those will be added separately.
"""

# Sport keywords for detection
SPORT_KEYWORDS = {
    "NBA": ["lakers", "celtics", "warriors", "nets", "knicks", "heat", "bulls",
            "cavs", "cavaliers", "sixers", "76ers", "bucks", "suns", "mavs",
            "mavericks", "clippers", "nuggets", "grizzlies", "kings", "hawks",
            "rebounds", "assists", "points", "pts", "reb", "ast", "3pm"],
    "NFL": ["chiefs", "eagles", "cowboys", "49ers", "bills", "ravens", "bengals",
            "lions", "packers", "dolphins", "jets", "patriots", "broncos", "raiders",
            "chargers", "steelers", "browns", "titans", "colts", "jaguars",
            "passing", "rushing", "yards", "touchdowns", "td"],
    "MLB": ["yankees", "dodgers", "astros", "braves", "mets", "phillies", "padres",
            "mariners", "rangers", "orioles", "twins", "guardians", "rays", "cubs",
            "runs", "hits", "strikeouts", "era", "home runs", "hr"],
    "NHL": ["bruins", "panthers", "rangers", "oilers", "avalanche", "stars",
            "hurricanes", "devils", "knights", "maple leafs", "canucks", "jets",
            "goals", "saves", "assists", "shots"]
}
