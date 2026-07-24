// Simple in-memory per-user, per-key cooldown tracker. Not persisted —
// cooldowns resetting on a restart is an acceptable tradeoff for the
// spam-prevention use case this covers (ticket creation, warn spam, etc).
const cooldowns = new Map();

function cooldownKey(scope, userId) {
  return `${scope}:${userId}`;
}

/**
 * Checks (and starts, if available) a cooldown.
 * Returns { onCooldown: false } if the action is allowed (and starts the timer),
 * or { onCooldown: true, remainingMs } if the user must wait.
 */
function checkCooldown(scope, userId, durationMs) {
  const key = cooldownKey(scope, userId);
  const now = Date.now();
  const expiresAt = cooldowns.get(key);

  if (expiresAt && expiresAt > now) {
    return { onCooldown: true, remainingMs: expiresAt - now };
  }

  cooldowns.set(key, now + durationMs);
  return { onCooldown: false, remainingMs: 0 };
}

function clearCooldown(scope, userId) {
  cooldowns.delete(cooldownKey(scope, userId));
}

function formatRemaining(ms) {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}m`;
}

module.exports = { checkCooldown, clearCooldown, formatRemaining };
