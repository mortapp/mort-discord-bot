# Mort Free / No-Pay Hosting Guide

This guide is for keeping Mort online without using the main laptop.

## Hard truth
A Discord Gateway bot needs a process that stays running. If the host sleeps, Mort goes offline. Most free web hosts sleep or limit uptime. The best free/no-monthly-bill routes are VM-based or hardware-based.

## Ranking

### 1. Oracle Cloud Always Free — best true cloud option
Best for: 24/7 bot hosting without a monthly bill.

Pros:
- Can run an Ubuntu VM 24/7 inside Always Free limits.
- Better than sleeping web hosts.
- Enough resources for a lightweight Discord bot.

Cons:
- Account signup may ask for identity/payment verification.
- Free resources can be limited by region availability.
- You must avoid paid shapes, disks, bandwidth, and resources.

Basic stack:
```bash
sudo apt update
sudo apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

git clone YOUR_PRIVATE_REPO_URL mort
cd mort
npm install
npm run register
pm2 start src/index.js --name mort
pm2 save
pm2 startup
```

### 2. Old Android phone + Termux — best true $0 if you own a spare phone
Best for: no card, no monthly cloud bill.

Pros:
- Actually free if you already own a spare Android phone.
- Does not use your main laptop RAM.

Cons:
- Phone must stay on, charged, and on Wi-Fi.
- Less reliable than a real VPS.

Commands:
```bash
pkg update
pkg install nodejs git
cd storage/downloads/mort-discord-bot-ultimate
npm install
npm run register
npm start
```

### 3. Spare PC / Raspberry Pi
Best for: free if the hardware is already available.

Pros:
- More stable than a phone.
- No cloud signup.

Cons:
- Uses home electricity and Wi-Fi.
- Still depends on hardware staying on.

### 4. Koyeb Free Instance
Best for: quick free tests and hobby usage.

Pros:
- Free instance type exists.
- Easy GitHub-based deploy.

Cons:
- Free instance resources are small.
- Free instance can scale to zero/sleep, which can disconnect a Discord bot.

Recommended only if Oracle/old phone is not possible.

### 5. Render Free Web Service
Best for: demos, not 24/7 Discord bots.

Pros:
- Easy GitHub deploy.
- Free web service tier exists.

Cons:
- Free web services can spin down and have monthly free-hour limits.
- Discord bots need constant uptime.

### 6. Railway / Fly.io
These are good developer platforms, but not the answer if the rule is “I am not paying anything.” Use only for trials or if you later accept low-cost hosting.

## What not to do
- Do not commit `.env` to GitHub.
- Do not paste your bot token in chat.
- Do not use keep-alive spam tricks that violate host rules.
- Do not run two copies of Mort with the same token at the same time.
- Do not use Discord self-bots.

## Best recommendation
1. Try Oracle Always Free.
2. If you cannot use Oracle, use an old Android phone with Termux.
3. If you have an old PC/Raspberry Pi, use that instead of your main laptop.
