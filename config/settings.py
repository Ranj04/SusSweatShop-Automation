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
DISCORD_CHANNEL_ID = 1458326660515627243  # Picks channel

# Gemini AI Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Bot Settings
DISCORD_INVITE_LINK = "discord.gg/ZNwbqrCGqN"
WEBSITE_URL = "https://sussweatshop.com"
TWITTER_HANDLE = "@SusSweatShop"

# Hashtags by sport (optimized for reach)
HASHTAGS = {
    "NBA": "#NBA #NBABets #NBAPicks #NBATwitter #Basketball",
    "NFL": "#NFL #NFLBets #NFLPicks #NFLTwitter #Football",
    "MLB": "#MLB #MLBBets #MLBPicks #MLBTwitter #Baseball",
    "NHL": "#NHL #NHLBets #NHLPicks #NHLTwitter #Hockey",
    "NCAAB": "#NCAAB #CollegeBasketball #CBB #MarchMadness",
    "NCAAF": "#NCAAF #CollegeFootball #CFB #CFBPicks",
    "UFC": "#UFC #MMA #UFCPicks #UFCBets",
    "SOCCER": "#Soccer #Football #EPL #LaLiga #SoccerPicks",
    "default": "#SportsBetting #FreePicks #GamblingTwitter #Betting #Winners"
}

# Trending/viral hashtags to rotate
VIRAL_HASHTAGS = [
    "#BettingTwitter",
    "#SportsBetting",
    "#FreePicks",
    "#GamblingX",
    "#BettingPicks",
    "#FadeOrTail",
    "#LockOfTheDay",
    "#POTD",
    "#Parlay",
    "#Winners"
]

# File to track posted picks (prevents duplicates)
POSTED_PICKS_FILE = "posted_picks.json"

# Gemini prompt template (human-like, natural tone)
GEMINI_PROMPT_TEMPLATE = """Write a casual, natural-sounding tweet about this sports bet: {pick}

IMPORTANT - Sound like a real person, NOT a bot:
- Write like you're sharing a bet with friends
- NO excessive emojis (0-2 max)
- NO ALL CAPS words like LOCK, HAMMER, SMASH
- NO cliche betting phrases like "trust the process" or "let's eat"
- Be conversational and genuine
- Briefly explain WHY you like the pick (1 sentence)
- Keep it short (2-3 sentences total)
- DO NOT include hashtags or links

Good example:
"Taking Curry over 25.5 points tonight. Warriors are at home and he always shows out against the Clippers. Like the matchup."

Bad example (avoid this):
"🔥🔥 LOCK OF THE DAY 🔥🔥 Curry OVER 25.5 PTS!! Sharps are all over this! HAMMER IT!! 💰💰"
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
            "goals", "saves", "assists", "shots"],
    "NCAAB": ["duke", "kentucky", "kansas", "unc", "north carolina", "gonzaga",
              "villanova", "ucla", "michigan", "purdue", "college basketball"],
    "NCAAF": ["alabama", "georgia", "ohio state", "michigan", "clemson", "texas",
              "usc", "oregon", "lsu", "college football"],
    "UFC": ["ufc", "mma", "fight", "knockout", "ko", "submission", "decision"],
    "SOCCER": ["premier league", "epl", "la liga", "serie a", "bundesliga",
               "champions league", "soccer", "goal", "nil"]
}
