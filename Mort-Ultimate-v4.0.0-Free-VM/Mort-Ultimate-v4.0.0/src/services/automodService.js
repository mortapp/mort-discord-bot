const { getGuild, addWarning, getWarnings } = require('./dataStore');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { sendLog } = require('../utils/logger');
const { applyEscalation } = require('../utils/escalation');

const INVITE_REGEX = /(discord\.gg\/|discord(?:app)?\.com\/invite\/)/i;

// Small, high-confidence scam/phishing pattern set. Kept intentionally
// narrow to avoid false positives — this isn't meant to be exhaustive.
const SCAM_PATTERNS = [
  /free\s*nitro/i,
  /discord\s*nitro.{0,20}(free|gift)/i,
  /steamcommunity\.com\/gift/i,
  /dlscord\.(gg|com)/i,
  /dlscordapp\.com/i,
  /discorcl\.(gg|com)/i,
  /discord-?(nitro|gift)s?\.(ru|xyz|top|click|info)/i
];

// Rolling per-user message history for spam/flood detection. In-memory
// only, mirrors the pattern used by raidService for join bursts.
const messageWindows = new Map(); // guildId -> Map(userId -> timestamps[])
const SPAM_WINDOW_MAX_AGE_MS = 10 * 60 * 1000;

const spamSweepTimer = setInterval(() => {
  const cutoff = Date.now() - SPAM_WINDOW_MAX_AGE_MS;
  for (const [guildId, guildMap] of messageWindows) {
    for (const [userId, timestamps] of guildMap) {
      if (!timestamps.some((timestamp) => timestamp >= cutoff)) guildMap.delete(userId);
    }
    if (guildMap.size === 0) messageWindows.delete(guildId);
  }
}, SPAM_WINDOW_MAX_AGE_MS);
spamSweepTimer.unref?.();

function defaults(memory) {
  const automod = memory.config?.automod || {};
  return {
    antiInvite: automod.antiInvite ?? false,
    blockedPhrases: automod.blockedPhrases || [],
    maxMentions: Number(automod.maxMentions || 0),
    antiScam: automod.antiScam ?? true,
    maxCapsPercent: Number(automod.maxCapsPercent ?? 0), // 0 = disabled
    spamFilter: {
      enabled: automod.spamFilter?.enabled ?? false,
      maxMessages: automod.spamFilter?.maxMessages ?? 5,
      windowSeconds: automod.spamFilter?.windowSeconds ?? 6
    },
    bypassRoleIds: automod.bypassRoleIds || [],
    bypassChannelIds: automod.bypassChannelIds || [],
    trustedBotIds: automod.trustedBotIds || []
  };
}

function hasAnyRule(config) {
  return config.antiInvite
    || config.blockedPhrases.length
    || config.maxMentions
    || config.antiScam
    || config.maxCapsPercent
    || config.spamFilter.enabled;
}

function isBypassed(message, config) {
  if (config.bypassChannelIds.includes(message.channel.id)) return true;
  const memberRoles = message.member?.roles?.cache;
  if (memberRoles && config.bypassRoleIds.some((id) => memberRoles.has(id))) return true;
  return false;
}

function capsRatio(content) {
  const letters = content.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 8) return 0; // too short to judge
  const upper = letters.replace(/[^A-Z]/g, '');
  return upper.length / letters.length;
}

function checkSpamFlood(guildId, userId, config) {
  if (!config.spamFilter.enabled) return false;
  const now = Date.now();
  const guildMap = messageWindows.get(guildId) || new Map();
  const bucket = guildMap.get(userId) || [];
  const recent = bucket.filter((ts) => now - ts < config.spamFilter.windowSeconds * 1000);
  recent.push(now);
  guildMap.set(userId, recent);
  messageWindows.set(guildId, guildMap);
  return recent.length > config.spamFilter.maxMessages;
}

function clearSpamWindow(guildId, userId) {
  const guildMap = messageWindows.get(guildId);
  if (!guildMap) return;
  guildMap.delete(userId);
  if (guildMap.size === 0) messageWindows.delete(guildId);
}

function detectViolation(message, config) {
  const content = message.content || '';
  const lower = content.toLowerCase();

  if (config.antiInvite && INVITE_REGEX.test(content)) {
    return { reason: 'Discord invite link blocked.', addWarning: true };
  }

  if (config.antiScam && SCAM_PATTERNS.some((pattern) => pattern.test(content))) {
    return { reason: 'Suspected scam/phishing link or nitro-scam text.', addWarning: true };
  }

  const matchedPhrase = config.blockedPhrases.find((phrase) => phrase && lower.includes(phrase));
  if (matchedPhrase) {
    return { reason: `Blocked phrase: ${matchedPhrase}`, addWarning: true };
  }

  if (config.maxMentions > 0 && message.mentions.users.size >= config.maxMentions) {
    return { reason: `Mass mention blocked (${message.mentions.users.size} mentions).`, addWarning: true };
  }

  if (config.maxCapsPercent > 0) {
    const ratio = capsRatio(content);
    if (ratio * 100 >= config.maxCapsPercent) {
      return { reason: `Excessive caps lock (${Math.round(ratio * 100)}%).`, addWarning: false };
    }
  }

  return null;
}

async function handleMessageCreate(message) {
  if (!message.guild || message.author.id === message.client.user.id) return;

  const memory = getGuild(message.guild.id);
  const config = defaults(memory);
  if (!hasAnyRule(config)) return;

  if (message.author.bot && config.trustedBotIds.includes(message.author.id)) return;
  const member = message.member;
  if (isBypassed(message, config)) return;

  let violation = detectViolation(message, config);
  const isFlooding = checkSpamFlood(message.guild.id, message.author.id, config);
  if (!violation && isFlooding) {
    violation = { reason: `Message spam detected (>${config.spamFilter.maxMessages} messages in ${config.spamFilter.windowSeconds}s).`, addWarning: true };
  }

  if (!violation) return;

  const deleted = await message.delete().then(() => true).catch(() => false);
  if (!deleted) {
    await sendLog(message.guild, memory, '⚠️ Automod Action Failed', `Mort detected a violation in ${message.channel} but could not delete the message.\nReason: ${violation.reason}`, COLORS.warning);
    return;
  }
  clearSpamWindow(message.guild.id, message.author.id);

  await message.channel.send({
    content: `<@${message.author.id}>`,
    allowedMentions: { users: [message.author.id] },
    embeds: [themedEmbed({
      title: '🛡️ Mort Automod',
      description: `${violation.reason}\nPlease follow the server rules.`,
      color: COLORS.warning
    })]
  }).then((sent) => setTimeout(() => sent.delete().catch(() => null), 8000).unref?.()).catch(() => null);

  await sendLog(message.guild, memory, '🛡️ Automod Action', `<@${message.author.id}> triggered automod in ${message.channel}.\nReason: ${violation.reason}`, COLORS.warning);

  if (violation.addWarning) {
    addWarning(message.guild.id, message.author.id, { moderatorId: message.client.user.id, reason: `Automod: ${violation.reason}`, source: 'automod' });
    const count = getWarnings(message.guild.id, message.author.id).length;
    await applyEscalation(message.guild, memory, member, count).catch(() => null);
  }
}

function stopAutomodSweep() {
  clearInterval(spamSweepTimer);
  messageWindows.clear();
}

module.exports = { handleMessageCreate, defaults, detectViolation, clearSpamWindow, stopAutomodSweep };
