# Mort v3.5.1 Railway Deploy Guide

## 1. GitHub repo layout

Your GitHub repo root must show:

```text
package.json
package-lock.json
railway.json
src/
data/
README.md
```

If Railway logs say it only sees `mort-bot-railway-ready/`, you uploaded the outer folder. Move the contents up so `package.json` is at the root.

## 2. Railway variables

Add variables in Railway → Service → Variables:

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


## 3. Add persistent storage

Add a Railway volume to the Mort service and mount it at:

```text
/data
```

Keep the Railway variable:

```env
DATA_FILE=/data/mort-memory.json
```

This preserves XP, economy balances, tickets, warnings, reminders, and server configuration across redeploys.

## 4. Railway commands

```text
Build Command: npm install
Start Command: npm start
```

## 5. Success logs

```text
Registered global commands.
Mort is online as Mort#3348
Mort health server listening on port 3000
```

## 6. Discord setup

Turn on Developer Portal intents:

```text
Server Members Intent
Message Content Intent
```

Then run:

```text
/setup server
/security refresh-perms
/verify panel
/mort dashboard
```
