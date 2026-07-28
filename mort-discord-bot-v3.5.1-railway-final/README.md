# Mort Ultimate Discord Bot v3.5.1

Mort Ultimate is a Railway-ready Discord.js v14 bot for the Mort app/community server. It builds the server, runs a strict verify gate, handles tickets, moderation, automod, XP, fake economy coins, anti-raid, anti-nuke, logs, backups, private rooms, reaction roles, and a local @mention support assistant.

## What is inside this ZIP

- Full Discord.js v14 bot source code
- Railway-ready root layout: `package.json` is at the ZIP root
- Strict verification gate with `Verify Me` button
- Better permission doctor and role hierarchy checker
- `/mort dashboard`, `/mort doctor`, `/mort permissions`, `/mort emergency-fix`
- @mention assistant: `@Mort how do I verify?`
- `/assistant` controls
- Ticket system with claim, rename, add/remove users, transcripts, and panel
- Moderation tools: warn, timeout, kick, ban, clear, lock, unlock, slowmode, userinfo, serverinfo
- Automod, anti-raid, anti-nuke, warning escalation
- Fake coin economy and XP/levels
- Fun utilities, avatar, reminders, polls, giveaways, starboard, reaction roles
- Health server for Railway
- Atomic JSON memory writes
- Hosting docs and AI prompts

## Railway deploy

Upload this folder to GitHub so the repository root shows:

```text
package.json
package-lock.json
railway.json
src/
data/
README.md
```

Do not upload an outer folder that hides `package.json` one level deep.

Railway settings:

```text
Build Command: npm install
Start Command: npm start
```

Railway variables:

```env
DISCORD_TOKEN=your_fresh_reset_token_here
CLIENT_ID=your_application_id_here
PUBLIC_KEY=a43eeacebf7e6d818de1fe35bca3ac949e580ae7b026247487c9c04ba3bec976
PORT=3000
DATA_FILE=/data/mort-memory.json
NODE_ENV=production
AUTO_REGISTER_COMMANDS=true
ASSISTANT_ENABLED=true
ASSISTANT_COOLDOWN_SECONDS=8
ASSISTANT_MAX_RESPONSE_LENGTH=1800
OWNER_IDS=your_discord_user_id_here
```

Never commit your bot token to GitHub.

## Persistent Railway data

Mort stores XP, economy balances, tickets, reminders, warnings, and server configuration in the JSON file selected by `DATA_FILE`. Railway deployment filesystems are temporary unless the service has a persistent volume.

In Railway, add a volume mounted at:

```text
/data
```

Then set:

```env
DATA_FILE=/data/mort-memory.json
```

Without that volume, Mort can still run, but saved server data may reset after a redeploy.

## Discord Developer Portal

Turn on:

```text
Server Members Intent
Message Content Intent
```

The @mention assistant needs Message Content Intent to read questions like `@Mort how do I verify?`.

## First Discord commands

```text
/setup server
/security refresh-perms
/verify panel
/mort dashboard
/mort doctor
/assistant status
```

If verify says missing permissions, fix Discord role order:

```text
Server Settings → Roles → drag Mort above Member, Verified, Unverified, Muted, and staff helper roles.
```

## Invite link

```text
https://discord.com/oauth2/authorize?client_id=your_application_id_here&permissions=8&integration_type=0&scope=bot+applications.commands
```

## Local test commands

```bash
npm install
npm run check
npm run doctor
npm run register
npm start
```

`npm run register` and `npm start` require a real `DISCORD_TOKEN`.

## Main command groups

```text
/mort
/setup
/security
/verify
/assistant
/ticket
/mod
/automod
/raid
/welcome
/level
/economy
/balance
/work
/fun
/avatar
/remind
/community
/reactionrole
/private
/voice
/panel
/logs
/backup
/features
/cloud
```

## Notes

Mort does not register 1,200 slash commands because Discord would become unusable. The feature catalog is browsable through `/features` and the bot implements the high-value live systems directly.
