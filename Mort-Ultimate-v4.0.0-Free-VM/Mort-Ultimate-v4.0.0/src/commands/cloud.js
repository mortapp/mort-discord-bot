const { SlashCommandBuilder } = require('discord.js');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');

const guides = {
  oracle: [
    '**Conditional free-tier VM option for the full Gateway bot.** Oracle’s current published Ampere A1 Always Free limit is up to 2 OCPUs / 12 GB total, but capacity is limited and idle VMs may be reclaimed under Oracle’s policy.',
    '1. Read Oracle’s current Always Free compute limits and its idle-reclamation rules first.',
    '2. Create one Ubuntu VM explicitly marked Always Free Eligible, only if capacity is available in your home region.',
    '3. Follow the bundled `FREE_VM_DEPLOY_GUIDE.md` for Node.js 22, secrets, durable state, command registration, firewall, and systemd.',
    '4. Allow only SSH ingress from your own IP; Mort needs outbound TLS to Discord, not a public bot port.',
    '5. Only use resources marked Always Free Eligible; monitor usage. Account approval, capacity, and uninterrupted free uptime are not guaranteed.'
  ],
  koyeb: [
    '**Free web service option, but watch sleep/scale limits.** Good for testing and small hobby bots.',
    '1. Push Mort to GitHub.',
    '2. Create a Koyeb Web Service from the repo.',
    '3. Use build command `npm install` and run command `npm start`.',
    '4. Add env vars: `DISCORD_TOKEN`, `CLIENT_ID`, `DATA_FILE`, and `OWNER_IDS`. Do not add an unused public key.',
    '5. If the free instance sleeps, Mort can disconnect until it wakes again.'
  ],
  render: [
    '**Free testing option, not ideal for a Discord Gateway bot.** Free web services can sleep/suspend; background workers are better but usually not free forever.',
    '1. Push Mort to GitHub.',
    '2. Render → New Web Service if using free web service, or Background Worker if paid later.',
    '3. Build command: `npm install`.',
    '4. Start command: `npm start`.',
    '5. Add env vars: `DISCORD_TOKEN`, `CLIENT_ID`, `DATA_FILE`, and `OWNER_IDS`.'
  ],
  google: [
    '**Possible Always Free VM option, but easy to get billed if you pick the wrong region/disk/network.** Use only if you can carefully follow limits.',
    '1. Create Google Cloud account.',
    '2. Create the free-tier eligible e2-micro VM in an eligible region only.',
    '3. Use only free-tier disk/network limits.',
    '4. Install Node.js 20 LTS, clone Mort, add `.env`, run with PM2.'
  ],
  android: [
    '**True $0 if you already have an old Android phone.** The phone becomes your tiny server.',
    '1. Install Termux from F-Droid.',
    '2. Run `pkg update && pkg install nodejs git`.',
    '3. Copy/clone Mort to the phone.',
    '4. Add `.env`.',
    '5. Run `npm install`, `npm run register`, `npm start`.',
    '6. Keep the phone charging and connected to Wi-Fi.'
  ],
  local: [
    '**Free but uses your hardware.** Use an old laptop/desktop/Raspberry Pi, not your main coding laptop.',
    '1. Install Node.js 20 LTS.',
    '2. Copy Mort onto the device.',
    '3. Add `.env` locally only.',
    '4. Run `npm install`, `npm run register`, `npm start` or PM2.',
    '5. Leave that device powered on.'
  ],
  railway: [
    '**Easy but not your no-pay final answer.** Railway is good for testing, but do not rely on it if you refuse any paid plan.',
    '1. Push Mort to GitHub.',
    '2. Railway → New Project → Deploy from GitHub repo.',
    '3. Add variables: `DISCORD_TOKEN`, `CLIENT_ID`, `DATA_FILE`, and `OWNER_IDS`.',
    '4. Start command: `npm start`.',
    '5. Watch pricing/credits before leaving it online.'
  ],
  fly: [
    '**Powerful but not recommended for no-pay.** Use only if you accept possible paid usage.',
    '1. Install Fly CLI.',
    '2. Run `fly launch` in the Mort folder.',
    '3. Set secrets with `fly secrets set DISCORD_TOKEN=... CLIENT_ID=... OWNER_IDS=...` and mount durable storage for `DATA_FILE`.',
    '4. Deploy with `fly deploy`.'
  ]
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cloud')
    .setDescription('Mort cloud/free hosting helper so you do not host on your main PC.')
    .addSubcommand((sub) => sub
      .setName('guide')
      .setDescription('Show hosting steps for a provider.')
      .addStringOption((opt) => opt
        .setName('provider')
        .setDescription('oracle, koyeb, render, google, android, local, railway, fly')
        .setRequired(true)))
    .addSubcommand((sub) => sub.setName('free').setDescription('Rank the best free/no-pay hosting options for Mort.'))
    .addSubcommand((sub) => sub.setName('env').setDescription('Show required cloud environment variables.'))
    .addSubcommand((sub) => sub.setName('health').setDescription('Show the Mort health endpoint path.')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'guide') {
      const provider = interaction.options.getString('provider', true).toLowerCase();
      const guide = guides[provider] || guides.oracle;
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: `☁️ Mort Hosting Guide: ${provider}`, description: guide.join('\n'), color: COLORS.lightBlue })] });
    }

    if (sub === 'free') {
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({
        title: '🆓 Mort Free Hosting Ranking',
        description: [
          '**1. Oracle Cloud Always Free VM** — potential no-monthly-host-cost route, subject to account eligibility, regional capacity, Always Free limits, and idle reclamation.',
          '**2. Old Android phone + Termux** — true $0 if you already own a phone; must stay charging/on Wi-Fi.',
          '**3. Spare PC/Raspberry Pi** — free money-wise but uses your electricity.',
          '**Avoid sleeping/serverless web tiers** for the full Gateway bot; they can disconnect or terminate Mort.',
          '**Important:** Free-tier capacity and uptime are not guaranteed; check the provider’s current limits and usage page.'
        ].join('\n'),
        color: COLORS.success
      })] });
    }

    if (sub === 'env') {
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🔐 Required Environment Variables', description: [
        '`DISCORD_TOKEN` — your reset bot token, never paste publicly',
        '`CLIENT_ID` — your application/client ID',
        '`DATA_FILE=/data/mort-memory.json` — use a persistent mounted path in production',
        '`OWNER_IDS=yourDiscordUserId` — enables configured-owner access for sensitive actions',
        '`AUTO_REGISTER_COMMANDS=false` — register commands deliberately with `npm run register`'
      ].join('\n'), color: COLORS.royalPurple })] });
    }

    if (sub === 'health') {
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🫀 Mort Health Check', description: 'If `PORT` is set, Mort serves liveness JSON at `/health` and `/status`, plus Discord readiness at `/ready`. Configure production hosts to probe `/ready`.', color: COLORS.success })] });
    }
  }
};
