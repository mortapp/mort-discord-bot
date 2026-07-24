# Mort Ultimate Discord Bot v3.1.0

Mort Ultimate is a coded Discord.js v14 bot for the Mort app/community server. It builds the server, locks unverified users to one verify channel, gives `🫧 Member` + `✅ Verified` immediately after verification, hides the verify channel after verification, creates private staff/VIP/beta/partner areas, and includes moderation, tickets, XP, logs, backups, anti-raid tools, cloud/free-hosting helpers, and a 1,200-module feature catalog.

## What is inside this ZIP

- Full Discord.js bot source code
- Strict verification gate
- Private role/channel blueprint
- Welcome/goodbye system
- Ticket system
- Moderation commands
- Automod commands
- XP/rank/leaderboard
- Reaction-role buttons
- Private room and temp voice systems
- Anti-raid/panic lockdown
- Logs and backups
- Health server for cloud hosts
- Free/no-pay hosting docs
- AI prompts for other coding AIs to improve Mort
- 1,200-module feature catalog/roadmap

## Install locally

```powershell
npm config set registry https://registry.npmjs.org/
npm install
npm run doctor
npm run register
npm start
```

## Required `.env`

```env
DISCORD_TOKEN=your_reset_token_here
CLIENT_ID=1518021714494226695
PUBLIC_KEY=a43eeacebf7e6d818de1fe35bca3ac949e580ae7b026247487c9c04ba3bec976
GUILD_ID=
OWNER_IDS=your_discord_user_id_here
PORT=3000
DATA_FILE=./data/mort-memory.json
NODE_ENV=production
```

Never commit or share your bot token.

## First commands in Discord

```text
/setup server
/security refresh-perms
/verify panel channel:#✅│verify
/logs channel channel:#🧾│mod-logs
/welcome status
/raid status
/features stats
/cloud free
```

## Important hosting docs

Read these files:

- `docs/FREE_HOSTING_GUIDE.md`
- `hosting/ORACLE_ALWAYS_FREE_SETUP.md`
- `hosting/ANDROID_TERMUX_SETUP.md`
- `hosting/KOYEB_FREE_SETUP.md`

Best no-pay choices:

1. Oracle Cloud Always Free if you can create the account and stay inside free limits.
2. Old Android phone + Termux if you want true $0 and already have a spare phone.
3. Spare PC/Raspberry Pi if you already have one.
4. Koyeb/Render free only for testing because free services can sleep or have limits.

## AI prompt docs

Read these files:

- `docs/AI_IMPROVEMENT_PROMPTS.md`
- `prompts/CODEX_MASTER_PROMPT.txt`
- `prompts/CLAUDE_ARCHITECT_PROMPT.txt`
- `prompts/CURSOR_REFACTOR_PROMPT.txt`

## Security

If you ever pasted your token publicly, reset it in the Discord Developer Portal before hosting Mort. Put the new token only in `.env` or your host's private environment-variable panel.

## Verification behavior

Before verify:
- User only sees `✅│verify`.

After pressing Verify:
- Mort adds `🫧 Member`.
- Mort adds `✅ Verified`.
- Mort removes `🚪 Unverified`.
- Mort hides `✅│verify` from that user.
- Mort sends/logs verified welcome if configured.

## Main command groups

```text
/setup
/security
/verify
/welcome
/ticket
/mod
/automod
/voice
/private
/reactionrole
/level
/community
/embed
/logs
/backup
/raid
/features
/cloud
/mort
/panel
```

## Notes

Mort does not create 1,200 slash commands. That would make the server unusable. It includes a 1,200-module feature catalog that can be browsed and enabled through `/features`.
