const { EmbedBuilder } = require('discord.js');
const { COLORS, THEME } = require('../config/blueprint');
const { diagnose } = require('./setupService');
const { diagnosePermissions, permissionFixText } = require('./permissionService');
const { getGuild, updateGuild } = require('./dataStore');

const mentionCooldown = new Map();

// Cooldown entries are keyed by guild+user and only ever added/refreshed by
// handleMentionQuestion, so on a long-running process this map would grow
// without bound. Sweep anything older than a generous window periodically.
const MENTION_COOLDOWN_MAX_AGE_MS = 30 * 60 * 1000;
const sweepTimer = setInterval(() => {
  const cutoff = Date.now() - MENTION_COOLDOWN_MAX_AGE_MS;
  for (const [key, last] of mentionCooldown) {
    if (last < cutoff) mentionCooldown.delete(key);
  }
}, 10 * 60 * 1000);
sweepTimer.unref?.();

async function isReplyToBot(message) {
  if (!message.reference?.messageId) return false;
  const referenced = message.channel?.messages?.cache?.get(message.reference.messageId)
    || await message.channel?.messages?.fetch(message.reference.messageId).catch(() => null);
  return Boolean(referenced?.author?.id === message.client.user.id);
}

function assistantConfig(guildId) {
  const memory = getGuild(guildId);
  const config = memory.config?.assistant || {};
  return {
    enabled: config.enabled ?? (process.env.ASSISTANT_ENABLED !== 'false'),
    channelId: config.channelId || process.env.ASSISTANT_CHANNEL_ID || null,
    cooldownSeconds: Number(config.cooldownSeconds || process.env.ASSISTANT_COOLDOWN_SECONDS || 8),
    maxLength: Number(process.env.ASSISTANT_MAX_RESPONSE_LENGTH || 1800)
  };
}

function setAssistantConfig(guildId, patch) {
  return updateGuild(guildId, (guild) => {
    if (!guild.config) guild.config = {};
    if (!guild.config.assistant) guild.config.assistant = {};
    Object.assign(guild.config.assistant, patch);
  });
}

function cleanPrompt(message, clientUserId) {
  return (message.content || '')
    .replace(new RegExp(`<@!?${clientUserId}>`, 'g'), '')
    .replace(/@everyone|@here/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function baseEmbed(title, description, color = COLORS.royalPurple) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(String(description || '').slice(0, 3900))
    .setColor(color)
    .setFooter({ text: THEME.footer })
    .setTimestamp();
}

function commandList() {
  return [
    '`/setup server` — build the Mort server layout',
    '`/setup fix` — repair missing roles/channels/permissions',
    '`/mort dashboard` — full bot/server status',
    '`/mort doctor` — exact missing permission/setup fixes',
    '`/verify panel` — send the Verify Me button',
    '`/verify repair` — fix verification roles/channel/panel',
    '`/ticket panel` or `/ticket open` — support tickets',
    '`/mod warn`, `/mod timeout`, `/mod purge` — moderation',
    '`/automod status` — spam/scam/invite filter status',
    '`/raid status`, `/security antinuke status` — server protection',
    '`/level rank`, `/economy profile` — XP and coins',
    '`/features stats` — Mort feature catalog'
  ].join('\n');
}

function quickAnswer(text, message) {
  const lower = text.toLowerCase();

  if (!text || hasAny(lower, ['help', 'commands', 'what can you do', 'what do you do', 'features'])) {
    return {
      title: '🤖 Mort Help',
      description: [
        'I am Mort, your server setup, verification, moderation, tickets, XP, economy, security, and support bot.',
        '',
        commandList(),
        '',
        'Ask me: **how do I verify**, **why missing permissions**, **how do tickets work**, **invite link**, **Railway status**, or **rules**.'
      ].join('\n')
    };
  }

  if (hasAny(lower, ['verify', 'verification', 'verified', 'unverified'])) {
    return {
      title: '✅ Verify Help',
      description: [
        'Go to the verify channel and press **Verify Me**.',
        'Mort gives **Member + Verified** and removes **Unverified**.',
        '',
        'If the button says **Missing Permissions**, an admin needs to drag Mort’s role above `Member`, `Verified`, and `Unverified`, then run `/verify repair`.'
      ].join('\n'),
      color: COLORS.success
    };
  }

  if (hasAny(lower, ['permission', 'missing permissions', 'role hierarchy', 'not working', 'cant', "can't", 'error'])) {
    return {
      title: '⚠️ Permission Fix',
      description: [
        'Most Mort issues come from Discord role hierarchy.',
        '',
        '**Fix:** Server Settings → Roles → drag Mort above the roles it needs to give/remove.',
        'Give Mort **Manage Roles**, **Manage Channels**, **Send Messages**, **Embed Links**, **Read Message History**, and **Use Application Commands**.',
        '',
        'Admin can run `/mort doctor` or `/mort permissions` for the exact missing pieces.'
      ].join('\n'),
      color: COLORS.warning
    };
  }

  if (hasAny(lower, ['ticket', 'support', 'help desk', 'report', 'appeal'])) {
    return {
      title: '🎫 Ticket Help',
      description: 'Use `/ticket open` or press the ticket button on Mort’s support panel. Staff can claim, rename, add users, remove users, generate transcripts, and close tickets.',
      color: COLORS.lightBlue
    };
  }

  if (hasAny(lower, ['moderation', 'moderator', 'mod', 'warn', 'timeout', 'ban', 'kick'])) {
    return {
      title: '🛡️ Moderation Help',
      description: 'Staff can use `/mod warn`, `/mod warnings`, `/mod timeout`, `/mod kick`, `/mod ban`, `/mod purge`, `/mod lock`, `/mod unlock`, and `/automod status`. Mort logs actions when a log channel exists.',
      color: COLORS.warning
    };
  }

  if (hasAny(lower, ['economy', 'coins', 'money', 'balance', 'daily', 'work', 'gamble', 'shop'])) {
    return {
      title: '💰 Economy Help',
      description: 'Mort economy is fake server coins only. Use `/balance`, `/work`, `/economy daily`, `/economy pay`, `/economy gamble`, `/economy shop`, `/economy inventory`, and `/economy leaderboard`.',
      color: COLORS.gold
    };
  }

  if (hasAny(lower, ['xp', 'level', 'rank', 'leaderboard'])) {
    return {
      title: '🏆 XP Help',
      description: 'Chat normally to gain XP with cooldown protection. Use `/level rank` and `/level leaderboard` to check progress. Staff can toggle XP with `/level toggle`.',
      color: COLORS.gold
    };
  }

  if (hasAny(lower, ['invite', 'add bot', 'invite link'])) {
    const clientId = process.env.CLIENT_ID || message.client.user.id;
    return {
      title: '🔗 Mort Invite',
      description: `Invite Mort with this link:\nhttps://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&integration_type=0&scope=bot+applications.commands`,
      color: COLORS.royalPurple
    };
  }

  if (hasAny(lower, ['railway', 'deploy', 'offline', 'restart', 'hosting', 'online'])) {
    return {
      title: '🚆 Railway / Hosting Help',
      description: [
        'Mort needs Railway variables: `DISCORD_TOKEN`, `CLIENT_ID`, `PUBLIC_KEY`, `PORT`, `DATA_FILE`, `NODE_ENV`, and optional `AUTO_REGISTER_COMMANDS=true`.',
        'Deploy logs should show `Registered global commands` and `Mort is online as ...`.',
        'If Mort goes offline, redeploy and check whether the bot token was reset.'
      ].join('\n'),
      color: COLORS.lightBlue
    };
  }

  if (hasAny(lower, ['rules', 'rule'])) {
    return {
      title: '📜 Rules',
      description: 'Keep it clean: no scams, spam, harassment, doxxing, malware, NSFW, hate speech, or bypassing staff decisions. Open a ticket if you need help.',
      color: COLORS.whiteGlow
    };
  }

  return {
    title: '🤖 Mort Answer',
    description: [
      `I saw your question: **${text.slice(0, 250)}**`,
      '',
      'I can answer Mort/server questions locally. Try asking me about **verify**, **permissions**, **tickets**, **moderation**, **economy**, **XP**, **invite**, **Railway**, **rules**, or **commands**.',
      'For a full check, staff can run `/mort dashboard`.'
    ].join('\n')
  };
}

async function handleMentionQuestion(message) {
  if (!message.guild || message.author.bot) return false;
  if (message.mentions.everyone) return false;

  const directlyMentioned = message.mentions.has(message.client.user);
  const repliedToMort = !directlyMentioned && await isReplyToBot(message);
  if (!directlyMentioned && !repliedToMort) return false;

  const config = assistantConfig(message.guild.id);
  if (!config.enabled) return false;
  if (config.channelId && message.channel.id !== config.channelId) return false;

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const last = mentionCooldown.get(key) || 0;
  const cooldownMs = Math.max(1, config.cooldownSeconds) * 1000;
  if (now - last < cooldownMs) {
    await message.reply({ content: `Slow down a sec — ask me again in ${Math.ceil((cooldownMs - (now - last)) / 1000)}s.` }).catch(() => null);
    return true;
  }
  mentionCooldown.set(key, now);

  const prompt = cleanPrompt(message, message.client.user.id);

  if (/\b(status|dashboard|doctor|health|check)\b/i.test(prompt)) {
    const [setupReport, permissionReport] = await Promise.all([
      diagnose(message.guild),
      diagnosePermissions(message.guild)
    ]);
    const setupLine = setupReport.healthy
      ? '✅ Setup blueprint is healthy.'
      : `⚠️ Missing ${setupReport.missing.roles.length} roles, ${setupReport.missing.categories.length} categories, ${setupReport.missing.channels.length} channels.`;
    const embed = baseEmbed('📊 Mort Status', [setupLine, '', permissionFixText(permissionReport)].join('\n'), permissionReport.healthy && setupReport.healthy ? COLORS.success : COLORS.warning);
    await message.reply({ embeds: [embed] }).catch(() => null);
    return true;
  }

  const answer = quickAnswer(prompt, message);
  await message.reply({ embeds: [baseEmbed(answer.title, String(answer.description).slice(0, config.maxLength), answer.color)] }).catch(() => null);
  return true;
}

module.exports = {
  handleMentionQuestion,
  quickAnswer,
  assistantConfig,
  setAssistantConfig
};
