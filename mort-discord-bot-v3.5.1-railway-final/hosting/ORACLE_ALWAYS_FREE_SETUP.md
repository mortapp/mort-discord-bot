# Oracle Always Free Setup for Mort

## Goal
Run Mort 24/7 without using your laptop.

## Steps
1. Create an Oracle Cloud Free Tier account.
2. Create an Always Free eligible Ubuntu instance.
3. Save the private SSH key.
4. SSH into the VM.
5. Install Node.js, git, and PM2.
6. Clone your private Mort repo.
7. Create `.env` on the VM.
8. Install packages and register commands.
9. Start Mort with PM2.

## Commands on the VM
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v
npm -v

git clone YOUR_PRIVATE_REPO_URL mort
cd mort
nano .env
npm install
npm run doctor
npm run register
pm2 start src/index.js --name mort
pm2 save
pm2 startup
```

## `.env` example
```env
DISCORD_TOKEN=your_reset_token_here
CLIENT_ID=your_application_id_here
PUBLIC_KEY=a43eeacebf7e6d818de1fe35bca3ac949e580ae7b026247487c9c04ba3bec976
PORT=3000
DATA_FILE=./data/mort-memory.json
OWNER_IDS=your_discord_user_id_here
NODE_ENV=production
```

## Useful PM2 commands
```bash
pm2 status
pm2 logs mort
pm2 restart mort
pm2 stop mort
pm2 save
```
