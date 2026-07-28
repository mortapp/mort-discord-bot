# Run this in the Mort bot folder. It writes .env without showing the token in your command history.
$token = Read-Host "Paste your Discord bot token"
$owner = Read-Host "Paste your Discord user ID for OWNER_IDS, or press Enter"
@"
DISCORD_TOKEN=$token
CLIENT_ID=1518021714494226695
PUBLIC_KEY=a43eeacebf7e6d818de1fe35bca3ac949e580ae7b026247487c9c04ba3bec976
GUILD_ID=
OWNER_IDS=$owner
PORT=3000
DATA_FILE=./data/mort-memory.json
NODE_ENV=production
"@ | Set-Content -Path ".env" -Encoding utf8
Write-Host "✅ .env written. Do not send it to anyone."
