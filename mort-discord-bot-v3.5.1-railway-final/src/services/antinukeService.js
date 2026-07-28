const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { getGuild, updateGuild } = require('./dataStore');
const { sendLog } = require('../utils/logger');
const { COLORS } = require('../config/blueprint');
const { applyChannelLockdown } = require('./raidService');

// Rolling per-executor action windows, kept in memory only (mirrors the
// pattern raidService.js already uses for join bursts).
const actionWindows = new Map(); // guildId -> Map(executorId -> timestamps[])

const WATCHED_EVENTS = new Set([
  AuditLogEvent.ChannelDelete,
  AuditLogEvent.ChannelCreate,
  AuditLogEvent.RoleDelete,
  AuditLogEvent.MemberBanAdd,
  AuditLogEvent.MemberKick,
  AuditLogEvent.WebhookCreate,
  AuditLogEvent.BotAdd
]);

function defaults(memory) {
  return {
    enabled: memory.config?.antiNuke?.enabled ?? true,
    threshold: memory.config?.antiNuke?.threshold ?? 5,
    windowSeconds: memory.config?.antiNuke?.windowSeconds ?? 60,
    punishment: memory.config?.antiNuke?.punishment ?? 'quarantine', // quarantine | kick | ban
    whitelist: memory.config?.antiNuke?.whitelist ?? [],
    protectBotAdds: memory.config?.antiNuke?.protectBotAdds ?? true
  };
}

function isWhitelisted(guild, memory, userId) {
  if (userId === guild.ownerId) return true;
  const config = defaults(memory);
  if (config.whitelist.includes(userId)) return true;
  return false;
}

function recordAction(guildId, executorId, windowSeconds) {
  const now = Date.now();
  const guildMap = actionWindows.get(guildId) || new Map();
  const bucket = guildMap.get(executorId) || [];
  const recent = bucket.filter((ts) => now - ts < windowSeconds * 1000);
  recent.push(now);
  guildMap.set(executorId, recent);
  actionWindows.set(guildId, guildMap);
  return recent.length;
}

async function quarantineExecutor(guild, memory, executorId, punishment, triggerLabel) {
  const member = await guild.members.fetch(executorId).catch(() => null);
  if (!member) return;

  try {
    if (punishment === 'ban') {
      await guild.members.ban(executorId, { reason: `Mort anti-nuke: ${triggerLabel}` });
    } else if (punishment === 'kick') {
      await member.kick(`Mort anti-nuke: ${triggerLabel}`);
    } else {
      // quarantine: strip all roles (except @everyone) so the account
      // loses every permission without removing them from the server,
      // which preserves evidence for staff review.
      const rolesToRemove = member.roles.cache.filter((role) => role.id !== guild.id);
      if (rolesToRemove.size) {
        await member.roles.remove(rolesToRemove, `Mort anti-nuke: ${triggerLabel}`).catch(() => null);
      }
      await member.timeout(10 * 60 * 1000, `Mort anti-nuke: ${triggerLabel}`).catch(() => null);
    }
  } catch (error) {
    await sendLog(guild, memory, '⚠️ Anti-Nuke Punishment Failed', `Tried to punish <@${executorId}> (${punishment}) but hit: ${error.message}. Mort may be missing permissions or role hierarchy.`, COLORS.warning).catch(() => null);
    return;
  }

  await sendLog(
    guild,
    memory,
    '🚨 Anti-Nuke Triggered',
    `<@${executorId}> was **${punishment === 'ban' ? 'banned' : punishment === 'kick' ? 'kicked' : 'quarantined'}** for: ${triggerLabel}\nIf this was a mistake, review \`/security antinuke whitelist-add\`.`,
    COLORS.danger
  );
}

async function handleAuditLogEntry(auditLogEntry, guild) {
  try {
    if (!WATCHED_EVENTS.has(auditLogEntry.action)) return;

    const memory = getGuild(guild.id);
    const config = defaults(memory);
    if (!config.enabled) return;

    const executorId = auditLogEntry.executorId;
    if (!executorId || executorId === guild.client.user.id) return;

    // Bot-add protection is handled separately (any single unauthorized
    // bot add is punished immediately rather than needing a burst).
    if (auditLogEntry.action === AuditLogEvent.BotAdd) {
      if (!config.protectBotAdds) return;
      if (isWhitelisted(guild, memory, executorId)) return;
      const addedBot = auditLogEntry.target;
      if (addedBot?.id) {
        await guild.members.kick(addedBot.id, 'Mort anti-nuke: unauthorized bot addition.').catch(() => null);
      }
      await sendLog(guild, memory, '🚨 Unauthorized Bot Add Blocked', `<@${executorId}> added a bot without anti-nuke whitelist clearance. The bot was removed.`, COLORS.danger);
      return;
    }

    if (isWhitelisted(guild, memory, executorId)) return;

    const count = recordAction(guild.id, executorId, config.windowSeconds);
    if (count < config.threshold) return;

    const label = `${count} destructive actions in ${config.windowSeconds}s (last: ${AuditLogEvent[auditLogEntry.action] || auditLogEntry.action})`;
    await quarantineExecutor(guild, memory, executorId, config.punishment, label);

    // Lock the server down defensively while staff investigate.
    updateGuild(guild.id, (g) => {
      g.config.antiRaid = { ...(g.config.antiRaid || {}), panic: true, lastTriggeredAt: new Date().toISOString() };
      g.config.verificationLocked = true;
    });
    await applyChannelLockdown(guild, memory, true).catch(() => null);
  } catch (error) {
    // Never let anti-nuke handling crash the bot.
    console.error('[Mort antinuke] handler error:', error);
  }
}

function antiNukeStatus(guildId) {
  const memory = getGuild(guildId);
  return defaults(memory);
}

function setAntiNuke(guildId, patch) {
  return updateGuild(guildId, (guild) => {
    guild.config.antiNuke = { ...defaults(guild), ...(guild.config.antiNuke || {}), ...patch };
  });
}

function addToWhitelist(guildId, userId) {
  return updateGuild(guildId, (guild) => {
    const config = defaults(guild);
    const set = new Set(config.whitelist);
    set.add(userId);
    guild.config.antiNuke = { ...config, whitelist: [...set] };
  });
}

function removeFromWhitelist(guildId, userId) {
  return updateGuild(guildId, (guild) => {
    const config = defaults(guild);
    guild.config.antiNuke = { ...config, whitelist: config.whitelist.filter((id) => id !== userId) };
  });
}

module.exports = {
  handleAuditLogEntry,
  antiNukeStatus,
  setAntiNuke,
  addToWhitelist,
  removeFromWhitelist
};
