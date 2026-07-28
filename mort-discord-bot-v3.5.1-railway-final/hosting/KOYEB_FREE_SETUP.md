# Koyeb Free Setup for Mort

## Warning
Koyeb free instances are useful, but free instances may sleep/scale down. A sleeping host can disconnect a Discord Gateway bot.

## Steps
1. Push Mort to a private GitHub repository.
2. Create a new Koyeb service from GitHub.
3. Select the free instance type if available.
4. Build command: `npm install`
5. Run command: `npm start`
6. Add environment variables:

```env
DISCORD_TOKEN=your_reset_token_here
CLIENT_ID=your_application_id_here
PUBLIC_KEY=a43eeacebf7e6d818de1fe35bca3ac949e580ae7b026247487c9c04ba3bec976
PORT=3000
DATA_FILE=./data/mort-memory.json
NODE_ENV=production
```

## Health paths
Mort exposes:
- `/`
- `/health`
- `/status`

These are only for host health checks. They do not replace the Discord Gateway connection.
