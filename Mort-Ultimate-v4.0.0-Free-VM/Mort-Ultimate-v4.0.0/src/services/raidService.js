const { PermissionFlagsBits } = require('discord.js');
const { getGuild, updateGuild } = require('./dataStore');
const { COLORS } = require('../config/blueprint');
const { sendLog } = require('../utils/logger');

const joinWindows = new Map();
const unlockTimers = new Map();
const LOCKED_PERMISSIONS = {
  SendMessages: PermissionFlagsBits.SendMessages,
  AddReactions: PermissionFlagsBits.AddReactions,
  CreatePublicThreads: PermissionFlagsBits.CreatePublicThreads,
  CreatePrivateThreads: PermissionFlagsBits.CreatePrivateThreads,
  Speak: PermissionFlagsBits.Speak
};

function defaults(memory) {
  return {
    enabled: memory.config?.antiRaid?.enabled ?? true,
    threshold: memory.config?.antiRaid?.threshold ?? 8,
    windowSeconds: memory.config?.antiRaid?.windowSeconds ?? 60,
    panic: memory.config?.antiRaid?.panic ?? false,
    minAccountAgeMinutes: memory.config?.antiRaid?.minAccountAgeMinutes ?? 0,
    minAccountAgeAction: memory.config?.antiRaid?.minAccountAgeAction ?? 'log',
    autoUnlockMinutes: memory.config?.antiRaid?.autoUnlockMinutes ?? 15
  };
}

function permissionState(overwrite, permission) {
  if (!overwrite) return null;
  if (overwrite.allow.has(permission)) return true;
  if (overwrite.deny.has(permission)) return false;
  return null;
}

function snapshotOverwrite(channel, roleId) {
  const overwrite = channel.permissionOverwrites.cache.get(roleId);
  return Object.fromEntries(Object.entries(LOCKED_PERMISSIONS).map(([name, permission]) => [name, permissionState(overwrite, permission)]));
}

async function applyChannelLockdown(guild, memory, locked) {
  const current = getGuild(guild.id);
  const targetRoleIds = [current.roles?.member, current.roles?.verified].filter(Boolean);
  if (!targetRoleIds.length) return { changed: false, failures: 0 };

  if (locked) {
    if (current.raidLockdown?.active) return { changed: false, failures: 0 };
    const snapshots = {};
    let changed = false;
    let failures = 0;
    for (const channel of guild.channels.cache.values()) {
      if (!channel?.permissionOverwrites?.edit) continue;
      for (const roleId of targetRoleIds) {
        const snapshot = snapshotOverwrite(channel, roleId);
        try {
          await channel.permissionOverwrites.edit(roleId, Object.fromEntries(Object.keys(LOCKED_PERMISSIONS).map((name) => [name, false])), { reason: 'Mort anti-raid panic lockdown' });
          snapshots[channel.id] ||= {};
          snapshots[channel.id][roleId] = snapshot;
          changed = true;
        } catch (error) {
          failures += 1;
        }
      }
    }
    if (changed) {
      updateGuild(guild.id, (state) => {
        state.raidLockdown = { active: true, appliedAt: new Date().toISOString(), snapshots };
      });
    }
    return { changed, failures };
  }

  const lockdown = current.raidLockdown;
  if (!lockdown?.active || !lockdown.snapshots) return { changed: false, failures: 0 };
  let changed = false;
  let failures = 0;
  for (const [channelId, roleSnapshots] of Object.entries(lockdown.snapshots)) {
    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.permissionOverwrites?.edit) continue;
    for (const [roleId, permissions] of Object.entries(roleSnapshots)) {
      try {
        await channel.permissionOverwrites.edit(roleId, permissions, { reason: 'Mort anti-raid panic restore' });
        changed = true;
      } catch (error) {
        failures += 1;
      }
    }
  }
  if (failures === 0) updateGuild(guild.id, (state) => { state.raidLockdown = null; });
  return { changed, failures };
}

function scheduleAutoUnlock(guild, minutes) {
  if (!minutes) return;
  const existing = unlockTimers.get(guild.id);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(async () => {
    unlockTimers.delete(guild.id);
    const current = getGuild(guild.id);
    if (!current.config?.antiRaid?.panic) return;
    const result = await applyChannelLockdown(guild, current, false).catch(() => ({ failures: 1 }));
    if (result.failures) return;
    updateGuild(guild.id, (state) => {
      state.config.antiRaid = { ...defaults(state), ...(state.config.antiRaid || {}), panic: false };
      state.config.verificationLocked = false;
    });
    await sendLog(guild, getGuild(guild.id), '🔓 Anti-Raid Auto-Unlock', `Mort restored the original channel permissions after **${minutes}m**.`, COLORS.success);
  }, minutes * 60 * 1000);
  timer.unref?.();
  unlockTimers.set(guild.id, timer);
}

async function checkAccountAge(member, memory, config) {
  if (!config.minAccountAgeMinutes) return false;
  const ageMinutes = (Date.now() - member.user.createdTimestamp) / 60000;
  if (ageMinutes >= config.minAccountAgeMinutes) return false;
  const reason = `Account is ${Math.round(ageMinutes)}m old (minimum: ${config.minAccountAgeMinutes}m).`;
  if (config.minAccountAgeAction === 'kick' && member.kickable) {
    await member.kick(`Mort anti-raid: ${reason}`);
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
  const recent = (joinWindows.get(member.guild.id) || []).filter((timestamp) => now - timestamp < config.windowSeconds * 1000);
  recent.push(now);
  joinWindows.set(member.guild.id, recent);
  if (config.panic || recent.length < config.threshold) return;

  updateGuild(member.guild.id, (state) => {
    state.config.antiRaid = { ...defaults(state), ...(state.config.antiRaid || {}), panic: true, lastTriggeredAt: new Date().toISOString(), lastJoinBurst: recent.length };
    state.config.verificationLocked = true;
  });
  const result = await applyChannelLockdown(member.guild, getGuild(member.guild.id), true);
  await sendLog(member.guild, getGuild(member.guild.id), '🚨 Anti-Raid Triggered', `Join burst detected: **${recent.length}** joins in **${config.windowSeconds}s**. Mort entered panic mode and safely snapshotted channel permissions. ${result.failures ? `(${result.failures} overwrite updates failed.)` : ''}`, COLORS.danger);
  scheduleAutoUnlock(member.guild, config.autoUnlockMinutes);
}

function antiRaidStatus(guildId) {
  const memory = getGuild(guildId);
  const config = defaults(memory);
  const now = Date.now();
  const recent = (joinWindows.get(guildId) || []).filter((timestamp) => now - timestamp < config.windowSeconds * 1000);
  joinWindows.set(guildId, recent);
  return { ...config, currentWindowJoins: recent.length, lastTriggeredAt: memory.config?.antiRaid?.lastTriggeredAt || null, lockdownApplied: Boolean(memory.raidLockdown?.active) };
}

function setAntiRaid(guildId, patch) {
  return updateGuild(guildId, (guild) => {
    guild.config.antiRaid = { ...defaults(guild), ...(guild.config.antiRaid || {}), ...patch };
  });
}

function stopRaidTimers() {
  for (const timer of unlockTimers.values()) clearTimeout(timer);
  unlockTimers.clear();
}

module.exports = { handleRaidJoin, antiRaidStatus, setAntiRaid, applyChannelLockdown, scheduleAutoUnlock, stopRaidTimers };
