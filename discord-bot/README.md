# SUSSWEATSHOP Discord Bot

A feature-rich Discord automation bot for sports betting communities. Increases engagement and helps premium conversions through automated onboarding, daily prompts, polls, activity tracking, and Whop integration.

## Features

- **Onboarding** - Welcome DMs with sport role selection, intro tracking, auto Member role
- **Daily Prompts** - Scheduled discussion starters with sport-based variables
- **Daily Polls** - Native Discord polls or reaction-based fallback
- **Sweat Threads** - Auto-created daily threads for live bet discussions
- **Activity Tracking** - Message counts with weekly leaderboards
- **Gamification** - Top Contributor role awards
- **Premium Nudges** - Non-annoying weekly premium info (max 1 per 7 days)
- **Whop Integration** - Automatic Premium role assignment via webhooks
- **Pikkit CSV Import** - Import bets from Pikkit exports with flexible column mapping
- **Auto Recaps** - Daily performance summaries with W-L record, ROI, and breakdowns
- **Visibility Tiers** - Tag bets as FREE/PREMIUM/STAFF for different audiences

## Tech Stack

- Node.js 20+
- TypeScript
- discord.js v14
- SQLite (better-sqlite3)
- node-cron for scheduling
- Express for webhooks

---

## Quick Start

### 1. Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" → Name it → Create
3. Go to **Bot** tab:
   - Click "Reset Token" → Copy the token (save it!)
   - Enable these **Privileged Gateway Intents**:
     - ✅ SERVER MEMBERS INTENT
     - ✅ MESSAGE CONTENT INTENT
4. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions:
     - ✅ Manage Roles
     - ✅ Send Messages
     - ✅ Send Messages in Threads
     - ✅ Create Public Threads
     - ✅ Embed Links
     - ✅ Add Reactions
     - ✅ Read Message History
     - ✅ View Channels
   - Copy the generated URL and open it to invite the bot

5. Get your IDs:
   - **Client ID**: OAuth2 → General → Application ID
   - **Guild ID**: Right-click your server → Copy Server ID (enable Developer Mode in Discord settings)

### 2. Install & Configure

```bash
# Clone/navigate to the project
cd discord-bot

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

Edit `.env` with your values:

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_guild_id_here
WHOP_WEBHOOK_SECRET=your_whop_secret
WHOP_LINK=https://whop.com/your-product
PORT=3000
TIMEZONE=America/New_York
```

### 3. Deploy Commands & Run

```bash
# Build TypeScript
npm run build

# Deploy slash commands to Discord
npm run deploy-commands

# Start the bot
npm start

# Or for development with hot reload:
npm run dev
```

---

## Configuration

After the bot is running, use these slash commands to configure it:

### Set Channels
```
/setchannel type:welcome channel:#welcome
/setchannel type:introductions channel:#introductions
/setchannel type:prompts channel:#discussion
/setchannel type:polls channel:#polls
/setchannel type:sweats channel:#sweats
/setchannel type:announcements channel:#announcements
```

### Set Roles
```
/setroles member:@Member premium:@Premium topcontributor:@Top Contributor
```

### Add Tracked Channels (for activity leaderboard)
```
/trackchannel add channel:#general
/trackchannel add channel:#discussion
/trackchannel list
```

### Configure Schedule
```
/schedule view
/schedule prompts times:10:00,16:00,19:00
/schedule poll time:12:00
/schedule sweatthread time:17:00
```

### Add Content
```
/addprompt text:What's your {sport} lock of the day?
/addpoll question:Tail or fade? options:Tail,Fade,Waiting
```

### Test Features
```
/test feature:prompt
/test feature:poll
/test feature:thread
/test feature:onboarding
```

### View Stats
```
/stats
/stats user:@someone
```

---

## Whop Integration

### Setup Whop Webhooks

1. Go to your [Whop Dashboard](https://dash.whop.com)
2. Navigate to **Developer → Webhooks**
3. Create a new webhook:
   - **URL**: `https://your-domain.com/webhooks/whop`
   - **Secret**: Generate one and add to `.env` as `WHOP_WEBHOOK_SECRET`
   - **Events**: Enable:
     - `membership.went_valid`
     - `membership.went_invalid`
     - `membership.cancelled`

4. Make sure users link their Discord in Whop settings

### How It Works

- When subscription becomes active → Premium role assigned + welcome DM
- When subscription expires/canceled → Premium role removed
- Mapping stored in SQLite for persistence

---

## Pikkit CSV Import

Import your betting history from Pikkit CSV exports. The bot handles deduplication, flexible column mapping, and visibility tagging.

### Importing CSV Files

1. Export your bets from Pikkit as CSV
2. Use the `/importpikkitcsv` command with the file attached
3. The bot auto-maps columns and imports non-duplicate bets

```
/importpikkitcsv file:[attach CSV] default_visibility:STAFF
```

### Column Mapping

The bot automatically maps common column names. If your CSV uses different headers, configure custom mappings:

```
/setcsvmap set field:pick column:selection_description
/setcsvmap set field:odds column:american_line
/setcsvmap set field:stake column:units_risked
/setcsvmap view
/setcsvmap reset
```

**Supported Fields:**
| Internal Field | Default Column Names |
|---------------|---------------------|
| `placed_at` | placed_at, placed, date_placed, created_at |
| `settled_at` | settled_at, settled, graded_at, result_date |
| `sport` | sport, sport_name, category |
| `league` | league, league_name, competition |
| `market` | market, market_type, bet_type, type |
| `pick` | pick, selection, description, bet, wager |
| `odds` | odds, price, american_odds, line |
| `stake` | stake, units, risk, wager_amount |
| `payout` | payout, to_win, potential_payout |
| `profit` | profit, profit_loss, pnl, return |
| `result` | result, status, outcome, grade |
| `book` | book, sportsbook, bookmaker |
| `tags` | tags, labels, shared |
| `visibility` | visibility, tier, access |

### Visibility Tiers

Bets are tagged with visibility for different audiences:

- **FREE** - Shown in public recaps (for free Discord members)
- **PREMIUM** - Shown in Premium recaps (includes FREE bets)
- **STAFF** - Private, only shown in STAFF recaps (includes all)

**Automatic Detection:**
- If CSV has a `tags` column containing "free", "public", or "shared" → FREE
- If tags contain "premium" or "vip" → PREMIUM
- Otherwise → STAFF (private by default)

**Manual Tagging:**
```
/tagbet bet_id:123 visibility:FREE
/tagbetsbulk date:2024-01-15 visibility:PREMIUM
/listbets date:2024-01-15
```

### Generating Recaps

Generate performance summaries on-demand or automatically:

```
/recap tier:FREE date:2024-01-15
/recap tier:PREMIUM range:week
/recap tier:STAFF range:month public:true
```

**Options:**
- `tier` - FREE (public only), PREMIUM (free+premium), STAFF (all)
- `date` - Specific date (YYYY-MM-DD), defaults to today
- `range` - day, week (7 days), month (30 days), all
- `public` - Post publicly or ephemeral (default)

**Recap Includes:**
- W-L-P record
- Total units risked
- Net profit/loss
- ROI percentage
- Breakdown by sport
- Breakdown by market type (ML, Spread, Props, etc.)

### Automated Daily Recaps

The bot automatically posts yesterday's results at 10:00 AM (configurable):

- Posts to #announcements channel
- Only posts if there are settled FREE-tier bets
- Won't duplicate posts for the same date

Configure schedule:
```
/schedule recap time:10:00
```

### Sample CSV Format

```csv
placed_at,settled_at,sport,market,pick,odds,stake,profit,result,book
2024-01-15,2024-01-15,NBA,Spread,Lakers -3.5,-110,1.0,0.91,WIN,DraftKings
2024-01-15,2024-01-15,NBA,Prop,LeBron O25.5 Pts,-115,2.0,-2.0,LOSS,FanDuel
2024-01-15,2024-01-15,NFL,ML,Chiefs ML,-150,1.5,1.0,WIN,BetMGM
```

---

## Project Structure

```
discord-bot/
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Configuration
│   ├── deploy-commands.ts    # Slash command deployment
│   ├── database/
│   │   ├── index.ts          # SQLite setup
│   │   └── repositories/     # Data access layer
│   │       ├── settings.ts
│   │       ├── prompts.ts
│   │       ├── polls.ts
│   │       ├── activity.ts
│   │       ├── subscriptions.ts
│   │       ├── introductions.ts
│   │       ├── premiumNudges.ts
│   │       ├── bets.ts           # Pikkit CSV bets
│   │       └── csvMappings.ts    # Column mapping config
│   ├── events/
│   │   ├── index.ts
│   │   ├── ready.ts
│   │   ├── guildMemberAdd.ts
│   │   ├── messageCreate.ts
│   │   └── interactionCreate.ts
│   ├── commands/
│   │   ├── index.ts
│   │   ├── setchannel.ts
│   │   ├── setroles.ts
│   │   ├── addprompt.ts
│   │   ├── addpoll.ts
│   │   ├── schedule.ts
│   │   ├── stats.ts
│   │   ├── test.ts
│   │   ├── trackchannel.ts
│   │   ├── importpikkitcsv.ts    # CSV import
│   │   ├── setcsvmap.ts          # Column mapping
│   │   ├── recap.ts              # Performance recaps
│   │   ├── tagbet.ts             # Single bet tagging
│   │   ├── tagbetsbulk.ts        # Bulk date tagging
│   │   └── listbets.ts           # View bets by date
│   ├── schedulers/
│   │   ├── index.ts
│   │   ├── prompts.ts
│   │   ├── polls.ts
│   │   ├── sweatThreads.ts
│   │   ├── leaderboard.ts
│   │   ├── premiumNudge.ts
│   │   └── dailyRecap.ts         # Auto daily recap
│   ├── webhooks/
│   │   └── whop.ts
│   └── utils/
│       ├── logger.ts
│       ├── helpers.ts
│       └── csvParser.ts          # CSV parsing logic
├── data/                     # SQLite database (created at runtime)
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## Deployment

### Option 1: VPS (Recommended)

```bash
# On your VPS (Ubuntu/Debian)
# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone your repo
git clone https://github.com/your-repo/discord-bot.git
cd discord-bot

# Install & build
npm install
npm run build

# Install PM2 for process management
npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name "sussweatshop-bot"
pm2 save
pm2 startup
```

### Option 2: Railway/Render

1. Push to GitHub
2. Connect to Railway/Render
3. Set environment variables
4. Deploy

### Option 3: Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY data ./data
CMD ["node", "dist/index.js"]
```

---

## Default Schedule

| Task | Time | Frequency |
|------|------|-----------|
| Daily Prompts | 10:00, 16:00, 19:00 | Daily |
| Daily Recap | 10:00 | Daily (if settled bets exist) |
| Daily Poll | 12:00 | Daily |
| Sweat Thread | 17:00 | Daily |
| Leaderboard | 09:00 | Mondays |
| Premium Nudge | 12:00 | Sundays (if 7+ days since last) |

All times in configured timezone (default: America/New_York)

---

## Sport Day Mapping

Default mapping (configurable):

| Day | Sport |
|-----|-------|
| Sunday | NFL |
| Monday | NBA |
| Tuesday | NBA |
| Wednesday | NBA |
| Thursday | NFL |
| Friday | NBA |
| Saturday | CFB |

Used in prompts with `{sport}` variable.

---

## Troubleshooting

### Bot not responding to commands
- Ensure commands are deployed: `npm run deploy-commands`
- Check bot has proper permissions in Discord
- Verify intents are enabled in Developer Portal

### DMs not sending
- User may have DMs disabled
- Bot falls back to welcome channel (configure with `/setchannel type:welcome`)

### Scheduled tasks not running
- Verify timezone in `.env`
- Check bot has permissions in target channels
- Use `/test feature:prompt` to test manually

### Whop webhooks failing
- Verify webhook secret matches
- Ensure users have Discord linked in Whop
- Check server is accessible (use ngrok for local testing)

---

## License

MIT

---

Built for SUSSWEATSHOP
