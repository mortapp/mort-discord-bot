const { getGuild, updateGuild } = require('./dataStore');
const { COLORS } = require('../config/blueprint');
const { sendLog } = require('../utils/logger');

const joinWindows = new Map();
const unlockTimers = new Map(); // guildId -> Timeout

function defaults(memory) {
  return {
    enabled: memory.config?.antiRaid?.enabled ?? true,
    threshold: memory.config?.antiRaid?.threshold ?? 8,
    windowSeconds: memory.config?.antiRaid?.windowSeconds ?? 60,
    panic: memory.config?.antiRaid?.panic ?? false,
    minAccountAgeMinutes: memory.config?.antiRaid?.minAccountAgeMinutes ?? 0, // 0 = disabled
    minAccountAgeAction: memory.config?.antiRaid?.minAccountAgeAction ?? 'log', // log | kick
    autoUnlockMinutes: memory.config?.antiRaid?.autoUnlockMinutes ?? 15 // 0 = never auto-unlock
  };
}

async function applyChannelLockdown(guild, memory, locked) {
  const memberRoleId = memory.roles?.member;
  const verifiedRoleId = memory.roles?.verified;
  const targets = [memberRoleId, verifiedRoleId].filter(Boolean);
  for (const channel of guild.channels.cache.values()) {
    if (!channel?.permissionOverwrites?.edit) continue;
    for (const roleId of targets) {
      await channel.permissionOverwrites.edit(roleId, {
        SendMessages: locked ? false : null,
        AddReactions: locked ? false : null,
        CreatePublicThreads: locked ? false : null,
        CreatePrivateThreads: locked ? false : null,
        Speak: locked ? false : null
      }, { reason: locked ? 'Mort anti-raid panic lockdown' : 'Mort anti-raid unlock' }).catch(() => null);
    }
  }
}

function scheduleAutoUnlock(guild, memory, minutes) {
  if (!minutes) return;
  const existing = unlockTimers.get(guild.id);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    unlockTimers.delete(guild.id);
    const current = getGuild(guild.id);
    if (!current.config?.antiRaid?.panic) return; // already cleared manually
    updateGuild(guild.id, (g) => {
      g.config.antiRaid = { ...defaults(g), ...(g.config.antiRaid || {}), panic: false };
      g.config.verificationLocked = false;
    });
    await applyChannelLockdown(guild, current, false).catch(() => null);
    await sendLog(guild, current, '🔓 Anti-Raid Auto-Unlock', `Mort automatically lifted the panic lockdown after **${minutes}m** with no further trigger.`, COLORS.success).catch(() => null);
  }, minutes * 60 * 1000);

  unlockTimers.set(guild.id, timer);
}

async function checkAccountAge(member, memory, config) {
  if (!config.minAccountAgeMinutes) return false;
  const ageMs = Date.now() - member.user.createdTimestamp;
  const ageMinutes = ageMs / 60000;
  if (ageMinutes >= config.minAccountAgeMinutes) return false;

  const reason = `Account is ${Math.round(ageMinutes)}m old (minimum: ${config.minAccountAgeMinutes}m).`;
  if (config.minAccountAgeAction === 'kick') {
    await member.kick(`Mort anti-raid: ${reason}`).catch(() => null);
    await sendLog(member.guild, memory, '🚨 New Account Kicked', `<@${member.id}> was kicked by anti-raid. ${reason}`, COLORS.warning);
  } else {
    await sendLog(member.guild, memory, '👀 New Account Flagged', `<@${member.id}> joined with a young account. ${reason}`, COLORS.warning);
  }
  return true;
}

async function handleRaidJoin(member) {
  const memory = getGuild(member.guild.id);
  const config = defaults(memory);
  if (!config.enabled) return;

  await checkAccountAge(member, memory, config);

  const now = Date.now();
  const bucket = joinWindows.get(member.guild.id) || [];
  const recent = bucket.filter((ts) => now - ts < config.windowSeconds * 1000);
  recent.push(now);
  joinWindows.set(member.guild.id, recent);

  if (config.panic || recent.length >= config.threshold) {
    updateGuild(member.guild.id, (guild) => {
      guild.config.antiRaid = { ...defaults(guild), panic: true, lastTriggeredAt: new Date().toISOString(), lastJoinBurst: recent.length };
      guild.config.verificationLocked = true;
    });
    await applyChannelLockdown(member.guild, memory, true).catch(() => null);
    await sendLog(member.guild, memory, '🚨 Anti-Raid Triggered', `Join burst detected: **${recent.length}** joins in **${config.windowSeconds}s**. Mort locked verification and channels.`, COLORS.danger);
    scheduleAutoUnlock(member.guild, memory, config.autoUnlockMinutes);
  }
}

function antiRaidStatus(guildId) {
  const memory = getGuild(guildId);
  const config = defaults(memory);
  const recent = joinWindows.get(guildId) || [];
  return { ...config, currentWindowJoins: recent.length, lastTriggeredAt: memory.config?.antiRaid?.lastTriggeredAt || null };
}

function setAntiRaid(guildId, patch) {
  return updateGuild(guildId, (guild) => {
    guild.config.antiRaid = { ...defaults(guild), ...(guild.config.antiRaid || {}), ...patch };
  });
}

module.exports = { handleRaidJoin, antiRaidStatus, setAntiRaid, applyChannelLockdown };
