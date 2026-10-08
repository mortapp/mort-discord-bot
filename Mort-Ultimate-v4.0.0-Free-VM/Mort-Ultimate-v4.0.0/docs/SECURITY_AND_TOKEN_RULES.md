# Mort Security and Token Rules

## Bot token rule
Your Discord bot token is the bot password. Never paste it into ChatGPT, Discord, GitHub, screenshots, or public logs.

If a token leaks:
1. Discord Developer Portal → Application → Bot → Reset Token.
2. Replace the token in `.env` or host environment variables.
3. Restart Mort.
4. Never use the leaked token again.

## GitHub rule
`.env` must stay ignored by Git.

Check `.gitignore` contains:
```text
.env
*.env
node_modules/
data/*.json
```

## Permissions rule
Mort can only manage roles below its own bot role. In Discord Server Settings → Roles, drag Mort’s role near the top.

## Hosting rule
Only store secrets in:
- Local `.env`
- Cloud host secret/environment variable panel
- Private server config

Never hard-code tokens into JS files.
