# Mort Discord Bot — Railway Deploy Guide

This package is Railway-ready.

## Required Railway Variables
Add these in Railway → your service → Variables:

DISCORD_TOKEN=your_current_discord_bot_token
CLIENT_ID=1518021714494226695
PUBLIC_KEY=a43eeacebf7e6d818de1fe35bca3ac949e580ae7b026247487c9c04ba3bec976
PORT=3000
DATA_FILE=./data/mort-memory.json
NODE_ENV=production

Optional:
GUILD_ID=
OWNER_IDS=

## Deploy path
1. Upload this folder to a GitHub repo.
2. Railway → New Project → Deploy from GitHub repo.
3. Pick the repo.
4. Add the variables above.
5. Railway should use `railway.json` and run `npm start`.
6. In Railway logs, look for:

Mort is online as Mort#3348
Mort health server listening on port 3000

## After deploy
Invite Mort with this link:
https://discord.com/oauth2/authorize?client_id=1518021714494226695&permissions=8&integration_type=0&scope=bot+applications.commands

Then run these slash commands inside Discord:
/setup server
/security refresh-perms
/verify panel

## Important
Do not commit a live .env file with your token. Put DISCORD_TOKEN in Railway Variables.
