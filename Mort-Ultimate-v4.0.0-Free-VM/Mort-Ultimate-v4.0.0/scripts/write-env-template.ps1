# Run this inside the Mort bot folder. Values are requested instead of hardcoded.
$token = Read-Host "Paste your Discord bot token"
$clientId = Read-Host "Paste your Discord Application ID"
$owner = Read-Host "Paste your Discord user ID for OWNER_IDS, or press Enter"
@"
DISCORD_TOKEN=$token
CLIENT_ID=$clientId
OWNER_IDS=$owner
PORT=3000
DATA_FILE=./data/mort-memory.json
NODE_ENV=development
AUTO_REGISTER_COMMANDS=false
ASSISTANT_ENABLED=true
ASSISTANT_COOLDOWN_SECONDS=8
ASSISTANT_MAX_RESPONSE_LENGTH=1800
"@ | Set-Content -Path ".env" -Encoding utf8
Write-Host ".env written. Do not commit or share it. Run npm run register, then npm start."

