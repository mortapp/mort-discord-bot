# Android Termux Setup for Mort

## Goal
Run Mort on an old Android phone so your laptop is free for coding.

## Setup
Install Termux from F-Droid, not random APK websites.

```bash
pkg update
pkg upgrade
pkg install nodejs git nano
node -v
npm -v
```

Copy Mort to the phone or clone from GitHub:
```bash
git clone YOUR_PRIVATE_REPO_URL mort
cd mort
nano .env
npm install
npm run register
npm start
```

Keep the phone:
- Charged
- On Wi-Fi
- Screen lock configured so Termux is not killed aggressively
- Away from overheating

This is free if you already own the phone, but less reliable than a VM.
