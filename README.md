# SUSSWEATSHOP Twitter Automation Bot

Automatically posts sports betting picks from Discord to Twitter with AI-generated analysis.

## Features

- Fetches picks from Discord channel automatically
- Generates professional analysis using Google Gemini AI (free tier)
- Attaches relevant player/team images
- Posts to Twitter on schedule (9 AM, 12 PM, 5 PM EST)
- Prevents duplicate posts
- Runs entirely on GitHub Actions (free)

## Quick Setup

### 1. Get Your API Keys

#### Twitter API
1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new project/app
3. Enable "Read and Write" permissions
4. Generate Access Token and Secret
5. You need: `API_KEY`, `API_SECRET`, `ACCESS_TOKEN`, `ACCESS_TOKEN_SECRET`

#### Discord Bot
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" tab and create a bot
4. Enable "Message Content Intent" under Privileged Gateway Intents
5. Copy the bot token
6. Invite bot to your server with "Read Message History" permission
   - Use this URL format: `https://discord.com/api/oauth2/authorize?client_id=YOUR_APP_ID&permissions=65536&scope=bot`

#### Google Gemini API
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Free tier includes 60 requests/minute

### 2. Fork This Repository

Click the "Fork" button at the top of this repo.

### 3. Add Secrets to GitHub

1. Go to your forked repo's Settings
2. Navigate to "Secrets and variables" > "Actions"
3. Add these secrets:

| Secret Name | Description |
|-------------|-------------|
| `TWITTER_API_KEY` | Twitter API Key |
| `TWITTER_API_SECRET` | Twitter API Secret |
| `TWITTER_ACCESS_TOKEN` | Twitter Access Token |
| `TWITTER_ACCESS_TOKEN_SECRET` | Twitter Access Token Secret |
| `DISCORD_BOT_TOKEN` | Discord Bot Token |
| `GEMINI_API_KEY` | Google Gemini API Key |

### 4. Enable GitHub Actions

1. Go to the "Actions" tab in your repo
2. Click "I understand my workflows, go ahead and enable them"

That's it! The bot will now run automatically at:
- **9:00 AM EST** - 1-2 posts
- **12:00 PM EST** - 1-2 posts
- **5:00 PM EST** - 1 post

## Local Development

### Prerequisites
- Python 3.9+
- pip

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/SusSweatShop-Automation.git
cd SusSweatShop-Automation

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Edit .env with your API keys
```

### Running Locally

```bash
# Verify all credentials work
python -m src.main --verify-only

# Dry run (doesn't actually post)
python -m src.main --dry-run

# Post 1 pick
python -m src.main --max-posts 1

# Post 2 picks
python -m src.main --max-posts 2
```

## Project Structure

```
sussweatshop-automation/
├── .github/
│   └── workflows/
│       └── post-tweets.yml    # GitHub Actions schedule
├── src/
│   ├── discord_fetcher.py     # Fetches picks from Discord
│   ├── ai_writer.py           # Generates write-ups with Gemini
│   ├── image_fetcher.py       # Gets stock images
│   ├── twitter_poster.py      # Posts to Twitter
│   └── main.py                # Orchestrates everything
├── config/
│   └── settings.py            # Configuration
├── requirements.txt           # Python dependencies
├── .env.example              # Example environment variables
└── README.md                 # This file
```

## How It Works

1. **Discord Fetcher** pulls recent messages from your picks channel
2. **AI Writer** sends picks to Gemini AI to generate analysis
3. **Image Fetcher** finds relevant player/team images
4. **Twitter Poster** combines everything and posts to Twitter
5. **Main Orchestrator** coordinates all components

## Customization

### Change Discord Channel
Edit `config/settings.py`:
```python
DISCORD_CHANNEL_ID = 1457600194672726220  # Your channel ID
```

### Modify AI Prompt
Edit `GEMINI_PROMPT_TEMPLATE` in `config/settings.py` to change the analysis style.

### Change Posting Schedule
Edit `.github/workflows/post-tweets.yml`:
```yaml
schedule:
  - cron: '0 14 * * *'  # 9 AM EST (14:00 UTC)
  - cron: '0 17 * * *'  # 12 PM EST (17:00 UTC)
  - cron: '0 22 * * *'  # 5 PM EST (22:00 UTC)
```

### Add More Hashtags
Edit `HASHTAGS` dictionary in `config/settings.py`.

## Manual Trigger

You can manually run the workflow:
1. Go to Actions tab
2. Select "Post Picks to Twitter"
3. Click "Run workflow"
4. Optionally set max posts and dry run mode

## Troubleshooting

### "No new picks found"
- Ensure your Discord bot is in the server
- Check that the channel ID is correct
- Verify the bot has "Read Message History" permission

### Twitter API errors
- Ensure you have "Read and Write" permissions
- Regenerate your access tokens if needed
- Check rate limits (Twitter allows 50 tweets/24h)

### Gemini API errors
- Verify your API key is valid
- Check you haven't exceeded rate limits
- The free tier allows 60 requests/minute

## Contributing

Pull requests welcome! For major changes, please open an issue first.

## License

MIT

---

Built for the SUSSWEATSHOP community
Join us: [discord.gg/ZNwbqrCGqN](https://discord.gg/ZNwbqrCGqN)
