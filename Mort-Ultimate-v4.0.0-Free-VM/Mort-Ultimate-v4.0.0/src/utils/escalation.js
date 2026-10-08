const { getGuild } = require('../services/dataStore');
const { sendLog } = require('./logger');
const { COLORS } = require('../config/blueprint');

// Default escalation ladder. Configurable per-guild via
// guild.config.warnEscalation, overridden with /mod (or a future
// /automod escalation command) if you want to expose it later.
const DEFAULT_LADDER = {
  timeoutAt: 3,
  timeoutMinutes: 60,
  kickAt: 5,
  banAt: 8
};

function getLadder(memory) {
  return { ...DEFAULT_LADDER, ...(memory.config?.warnEscalation || {}) };
}

/**
 * Applies the warn -> timeout -> kick -> ban ladder based on a user's
 * current total warning count. Safe to call after any addWarning() call.
 * Returns a short description of any action taken, or null.
 */
async function applyEscalation(guild, memory, member, warningCount) {
  if (!member) return null;
  const ladder = getLadder(memory);

  try {
    if (ladder.banAt && warningCount >= ladder.banAt) {
      await member.ban({ reason: `Mort auto-escalation: reached ${warningCount} warnings.` });
      await sendLog(guild, memory, '🔨 Auto-Escalation: Ban', `<@${member.id}> was auto-banned after reaching **${warningCount}** warnings.`, COLORS.danger);
      return `banned (reached ${warningCount} warnings)`;
    }
    if (ladder.kickAt && warningCount >= ladder.kickAt) {
      await member.kick(`Mort auto-escalation: reached ${warningCount} warnings.`);
      await sendLog(guild, memory, '👢 Auto-Escalation: Kick', `<@${member.id}> was auto-kicked after reaching **${warningCount}** warnings.`, COLORS.danger);
      return `kicked (reached ${warningCount} warnings)`;
    }
    if (ladder.timeoutAt && warningCount >= ladder.timeoutAt) {
      const ms = (ladder.timeoutMinutes || 60) * 60 * 1000;
      await member.timeout(ms, `Mort auto-escalation: reached ${warningCount} warnings.`);
      await sendLog(guild, memory, '⏳ Auto-Escalation: Timeout', `<@${member.id}> was auto-timed-out for **${ladder.timeoutMinutes}m** after reaching **${warningCount}** warnings.`, COLORS.warning);
      return `timed out for ${ladder.timeoutMinutes}m (reached ${warningCount} warnings)`;
    }
  } catch (error) {
    // Missing permissions / role hierarchy issues shouldn't crash the caller.
    await sendLog(guild, memory, '⚠️ Auto-Escalation Failed', `Mort tried to escalate <@${member.id}> but hit an error: ${error.message}`, COLORS.warning).catch(() => null);
  }
  return null;
}

module.exports = { applyEscalation, getLadder, DEFAULT_LADDER };
