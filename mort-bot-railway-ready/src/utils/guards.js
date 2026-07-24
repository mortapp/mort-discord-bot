const { PermissionFlagsBits } = require('discord.js');

let warnedNoOwners = false;

// isOwnerAllowed is intentionally permissive (fails open) for legacy
// callers that just want a soft check. It exists so pre-existing code
// keeps working, but new owner-gated logic should use requireOwner()
// below, which fails closed.
function isOwnerAllowed(userId) {
  const ownerIds = (process.env.OWNER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (ownerIds.length === 0) {
    if (!warnedNoOwners) {
      console.warn('[Mort] OWNER_IDS is not set. Owner-only commands are running in an unrestricted fallback mode. Set OWNER_IDS in your .env to lock this down.');
      warnedNoOwners = true;
    }
    return true;
  }
  return ownerIds.includes(userId);
}

// requireOwner fails closed: if OWNER_IDS isn't configured, nobody
// passes. Use this for anything security-sensitive (anti-nuke config,
// backups, /cloud, /private admin actions).
function requireOwner(userId) {
  const ownerIds = (process.env.OWNER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (ownerIds.length === 0) {
    throw new Error('OWNER_IDS is not configured, so no one is authorized for this command yet. Set OWNER_IDS in your .env.');
  }
  if (!ownerIds.includes(userId)) {
    throw new Error('Only a configured Mort owner can use this command.');
  }
}

function requireManageGuild(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    throw new Error('You need the Manage Server permission to use this command.');
  }
}

function requireModerator(interaction) {
  const allowed = interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
    || interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)
    || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  if (!allowed) throw new Error('You need moderation permissions to use this command.');
}

module.exports = {
  isOwnerAllowed,
  requireOwner,
  requireManageGuild,
  requireModerator
};
