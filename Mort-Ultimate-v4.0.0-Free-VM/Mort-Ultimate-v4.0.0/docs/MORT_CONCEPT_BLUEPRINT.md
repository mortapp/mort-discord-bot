# Mort Ultimate Concept Blueprint

## Core identity
Mort is the Discord control system for the Mort app/community. The design language is black, royal purple, light blue, and white. Mort should feel like a custom command center, not a generic moderation bot.

## Main goals
1. Build the whole Discord server automatically.
2. Lock new users inside the verify channel until they verify.
3. Give `🫧 Member` and `✅ Verified` instantly after verification.
4. Hide the verify channel after verification.
5. Create private spaces for staff, admins, beta testers, partners, VIPs, and support.
6. Provide moderation, tickets, logs, automod, anti-raid, XP, private voice rooms, welcome/goodbye, panels, backups, and repair tools.
7. Stay cloud-ready so the bot does not need to run from the owner’s laptop.

## Server behavior

### Before verification
A new user should only see:
- `✅│verify`

They should not see:
- General chat
- Voice channels
- Tickets
- Staff channels
- App channels
- Beta/VIP/private channels

### After verification
When the user clicks Verify:
- Add `🫧 Member`
- Add `✅ Verified`
- Remove `🚪 Unverified`
- Hide `✅│verify` from the user
- Show community channels
- Send verified welcome message
- Log the verification event if logs are configured

## Role blueprint
- `👑 Owner`
- `🛡️ Admin`
- `🧰 Moderator`
- `💬 Helper`
- `🧑‍💻 Developer`
- `🎨 Designer`
- `🤝 Partner`
- `💎 VIP`
- `🧪 Beta Tester`
- `✅ Verified`
- `🫧 Member`
- `🚪 Unverified`
- `🔇 Muted`
- `🤖 Bot`

## Channel blueprint

### Start here
- `✅│verify`
- `📜│rules`
- `📢│announcements`
- `🗺️│server-map`
- `👋│welcome`
- `👋│goodbye`

### Community
- `💬│general`
- `📸│media`
- `🎬│clips`
- `💡│suggestions`
- `📊│polls`
- `🏆│leaderboard`

### Mort app
- `📱│app-updates`
- `🐞│bugs`
- `🧠│feature-ideas`
- `🧪│beta-testing`
- `🛣️│roadmap`
- `🧾│changelog`
- `❓│faq`
- `📚│resources`

### Support
- `🎫│create-ticket`
- `🧾│ticket-logs`
- `🚨│reports`
- `🆘│safety-help`
- `⚖️│appeals`

### Private
- `🔐│staff-chat`
- `🧾│mod-logs`
- `🚪│join-logs`
- `🛡️│raid-logs`
- `👑│owner-room`
- `💎│vip-lounge`
- `🤝│partner-room`
- `🧪│beta-room`
- `🚀│collabs`
- `🌟│showcase`

### Voice
- `🔊│General VC`
- `🌙│Chill VC`
- `🛠️│Work VC`
- `➕│Create Room`
- `🔐│Staff VC`
- `💎│VIP VC`
- `🧪│Beta VC`

## Built systems
- Server setup and repair
- Verification gate
- Welcome/goodbye
- Tickets
- Moderation
- Automod
- Anti-raid panic/lockdown
- Logs
- XP/rank/leaderboard
- Reaction roles
- Private room creation
- Temp voice channels
- Embeds/panels
- Backup export/prune
- Cloud/free hosting helper
- 1,200-module feature catalog

## Design rules
- Prefer clean embeds over spammy messages.
- Use ephemeral replies for staff/admin confirmations.
- Never expose tokens or secrets.
- Keep dangerous commands staff-only.
- Avoid creating 1,200 slash commands. Use grouped commands and feature flags.
- Make `/setup repair` safe to run multiple times.
