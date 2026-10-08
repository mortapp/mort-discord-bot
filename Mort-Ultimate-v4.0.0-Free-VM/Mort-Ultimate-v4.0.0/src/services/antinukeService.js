const { AuditLogEvent } = require('discord.js');
const { getGuild, updateGuild } = require('./dataStore');
const { sendLog } = require('../utils/logger');
const { COLORS } = require('../config/blueprint');
const { applyChannelLockdown } = require('./raidService');

const actionWindows = new Map();
const activePunishments = new Set();
const WATCHED_EVENTS = new Set([
  AuditLogEvent.ChannelDelete, AuditLogEvent.ChannelCreate, AuditLogEvent.ChannelUpdate,
  AuditLogEvent.ChannelOverwriteCreate, AuditLogEvent.ChannelOverwriteUpdate, AuditLogEvent.ChannelOverwriteDelete,
  AuditLogEvent.RoleCreate, AuditLogEvent.RoleUpdate, AuditLogEvent.RoleDelete,
  AuditLogEvent.MemberRoleUpdate, AuditLogEvent.MemberBanAdd, AuditLogEvent.MemberKick,
  AuditLogEvent.WebhookCreate, AuditLogEvent.WebhookUpdate, AuditLogEvent.WebhookDelete,
  AuditLogEvent.BotAdd
]);

function defaults(memory) {
  return {
    enabled: memory.config?.antiNuke?.enabled ?? true,
    threshold: memory.config?.antiNuke?.threshold ?? 5,
    windowSeconds: memory.config?.antiNuke?.windowSeconds ?? 60,
    punishment: memory.config?.antiNuke?.punishment ?? 'quarantine',
    whitelist: Array.isArray(memory.config?.antiNuke?.whitelist) ? memory.config.antiNuke.whitelist : [],
    protectBotAdds: memory.config?.antiNuke?.protectBotAdds ?? true
  };
}

function isWhitelisted(guild, memory, userId) {
  return userId === guild.ownerId || defaults(memory).whitelist.includes(userId);
}

function recordAction(guildId, executorId, windowSeconds) {
  const now = Date.now();
  const guildMap = actionWindows.get(guildId) || new Map();
  const recent = (guildMap.get(executorId) || []).filter((timestamp) => now - timestamp < windowSeconds * 1000);
  recent.push(now);
  guildMap.set(executorId, recent);
  actionWindows.set(guildId, guildMap);
  return recent.length;
}

function clearActionWindow(guildId, executorId) {
  const guildMap = actionWindows.get(guildId);
  if (!guildMap) return;
  guildMap.delete(executorId);
  if (guildMap.size === 0) actionWindows.delete(guildId);
}

async function quarantineExecutor(guild, memory, executorId, punishment, triggerLabel) {
  const member = await guild.members.fetch(executorId).catch(() => null);
  if (!member) {
    await sendLog(guild, memory, '⚠️ Anti-Nuke Target Missing', `Mort detected destructive activity by <@${executorId}> but they are no longer in the server. Trigger: ${triggerLabel}`, COLORS.warning);
    return false;
  }
  if ((punishment === 'ban' && !member.bannable) || (punishment === 'kick' && !member.kickable) || (punishment === 'quarantine' && !member.manageable)) {
    await sendLog(guild, memory, '⚠️ Anti-Nuke Punishment Blocked', `Mort detected <@${executorId}> but cannot apply **${punishment}** due to Discord permissions or role hierarchy. Trigger: ${triggerLabel}`, COLORS.warning);
    return false;
  }

  try {
    if (punishment === 'ban') {
      await member.ban({ reason: `Mort anti-nuke: ${triggerLabel}` });
    } else if (punishment === 'kick') {
      await member.kick(`Mort anti-nuke: ${triggerLabel}`);
    } else {
      const rolesToRemove = member.roles.cache.filter((role) => role.id !== guild.id && !role.managed);
      if (rolesToRemove.size) await member.roles.remove(rolesToRemove, `Mort anti-nuke: ${triggerLabel}`);
      if (member.moderatable) await member.timeout(10 * 60 * 1000, `Mort anti-nuke: ${triggerLabel}`);
    }
  } catch (error) {
    await sendLog(guild, memory, '⚠️ Anti-Nuke Punishment Failed', `Tried to punish <@${executorId}> (${punishment}) but hit: ${error.message}.`, COLORS.warning);
    return false;
  }

  await sendLog(guild, memory, '🚨 Anti-Nuke Triggered', `<@${executorId}> was **${punishment === 'ban' ? 'banned' : punishment === 'kick' ? 'kicked' : 'quarantined'}** for: ${triggerLabel}\nReview the anti-nuke whitelist before restoring access.`, COLORS.danger);
  return true;
}

async function enterDefensiveLockdown(guild) {
  updateGuild(guild.id, (state) => {
    state.config.antiRaid = { ...(state.config.antiRaid || {}), panic: true, lastTriggeredAt: new Date().toISOString() };
    state.config.verificationLocked = true;
  });
  await applyChannelLockdown(guild, getGuild(guild.id), true).catch(() => null);
}

async function handleUnauthorizedBotAdd(auditLogEntry, guild, memory, config) {
  if (!config.protectBotAdds) return;
  const executorId = auditLogEntry.executorId;
  if (isWhitelisted(guild, memory, executorId)) return;
  const addedBot = auditLogEntry.target;
  const botMember = addedBot?.id ? await guild.members.fetch(addedBot.id).catch(() => null) : null;
  if (botMember?.kickable) await botMember.kick('Mort anti-nuke: unauthorized bot addition.').catch(() => null);
  await quarantineExecutor(guild, memory, executorId, config.punishment, 'unauthorized bot addition');
  await enterDefensiveLockdown(guild);
}

async function handleAuditLogEntry(auditLogEntry, guild) {
  try {
    if (!WATCHED_EVENTS.has(auditLogEntry.action)) return;
    const memory = getGuild(guild.id);
    const config = defaults(memory);
    if (!config.enabled) return;
    const executorId = auditLogEntry.executorId;
    if (!executorId || executorId === guild.client.user.id || isWhitelisted(guild, memory, executorId)) return;

    if (auditLogEntry.action === AuditLogEvent.BotAdd) {
      await handleUnauthorizedBotAdd(auditLogEntry, guild, memory, config);
      return;
    }

    const count = recordAction(guild.id, executorId, config.windowSeconds);
    if (count < config.threshold) return;
    const key = `${guild.id}:${executorId}`;
    if (activePunishments.has(key)) return;
    activePunishments.add(key);
    clearActionWindow(guild.id, executorId);
    try {
      const label = `${count} destructive actions in ${config.windowSeconds}s (last: ${AuditLogEvent[auditLogEntry.action] || auditLogEntry.action})`;
      await quarantineExecutor(guild, memory, executorId, config.punishment, label);
      await enterDefensiveLockdown(guild);
    } finally {
      activePunishments.delete(key);
    }
  } catch (error) {
    console.error('[Mort anti-nuke] handler error:', error);
  }
}

function antiNukeStatus(guildId) { return defaults(getGuild(guildId)); }

function setAntiNuke(guildId, patch) {
  return updateGuild(guildId, (guild) => {
    guild.config.antiNuke = { ...defaults(guild), ...(guild.config.antiNuke || {}), ...patch };
  });
}

function addToWhitelist(guildId, userId) {
  return updateGuild(guildId, (guild) => {
    const config = defaults(guild);
    guild.config.antiNuke = { ...config, whitelist: [...new Set([...config.whitelist, userId])] };
  });
}

function removeFromWhitelist(guildId, userId) {
  return updateGuild(guildId, (guild) => {
    const config = defaults(guild);
    guild.config.antiNuke = { ...config, whitelist: config.whitelist.filter((id) => id !== userId) };
  });
}

function stopAntiNukeTracking() {
  actionWindows.clear();
  activePunishments.clear();
}

module.exports = { handleAuditLogEntry, antiNukeStatus, setAntiNuke, addToWhitelist, removeFromWhitelist, stopAntiNukeTracking };
