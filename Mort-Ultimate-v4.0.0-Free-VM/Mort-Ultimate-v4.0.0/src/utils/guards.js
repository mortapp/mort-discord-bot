const { PermissionFlagsBits } = require('discord.js');

const PRIVILEGED_ROLE_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.ManageMessages
];

function configuredOwnerIds() {
  return (process.env.OWNER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function isOwnerAllowed(userId) {
  const owners = configuredOwnerIds();
  return owners.length > 0 && owners.includes(userId);
}

function requireOwner(userId) {
  const owners = configuredOwnerIds();
  if (owners.length === 0) {
    throw new Error('OWNER_IDS is not configured. Add your Discord user ID before using this owner-only action.');
  }
  if (!owners.includes(userId)) throw new Error('Only a configured Mort owner can use this command.');
}

function requireGuild(interaction) {
  if (!interaction?.inGuild?.() || !interaction.guild) {
    throw new Error('This command can only be used inside a Discord server.');
  }
}

function requirePermission(interaction, permission, label) {
  requireGuild(interaction);
  if (!interaction.memberPermissions?.has(permission)) {
    throw new Error(`You need the ${label} permission to use this action.`);
  }
}

function requireManageGuild(interaction) {
  requirePermission(interaction, PermissionFlagsBits.ManageGuild, 'Manage Server');
}

function requireGuildOwnerOrConfiguredOwner(interaction) {
  requireGuild(interaction);
  const isGuildOwner = interaction.guild.ownerId === interaction.user.id;
  if (!isGuildOwner && !isOwnerAllowed(interaction.user.id)) {
    throw new Error('Only the server owner or a configured Mort owner can use this security-sensitive action.');
  }
}

function requireModerator(interaction) {
  requireGuild(interaction);
  const allowed = interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
    || interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)
    || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  if (!allowed) throw new Error('You need moderation permissions to use this command.');
}

function canBotManageRole(guild, role) {
  const botMember = guild.members.me;
  return Boolean(role && !role.managed && role.id !== guild.id && botMember
    && role.comparePositionTo(botMember.roles.highest) < 0);
}

function isPrivilegedRole(role) {
  return PRIVILEGED_ROLE_PERMISSIONS.some((permission) => role?.permissions?.has?.(permission));
}

function assertSafeAssignableRole(guild, role) {
  if (!role || role.id === guild.id || role.name === '@everyone') {
    throw new Error('The @everyone role cannot be assigned by Mort.');
  }
  if (role.managed) throw new Error('Integration-managed roles cannot be assigned by Mort.');
  if (isPrivilegedRole(role)) {
    throw new Error('Mort refuses to self-assign roles with moderation or server-management permissions.');
  }
  if (!canBotManageRole(guild, role)) {
    throw new Error(`Mort cannot manage ${role.name}. Move Mort’s role above it in Server Settings → Roles.`);
  }
}

function assertCanModerateTarget(interaction, target) {
  requireGuild(interaction);
  if (!target) throw new Error('That member is no longer in this server.');
  if (target.id === interaction.user.id) throw new Error('You cannot moderate yourself.');
  if (target.user?.bot) throw new Error('Mort will not moderate bot accounts with this command.');
  if (target.id === interaction.guild.ownerId) throw new Error('The server owner cannot be moderated by Mort.');

  const isGuildOwner = interaction.guild.ownerId === interaction.user.id;
  const actorHighest = interaction.member?.roles?.highest;
  if (!isGuildOwner && actorHighest && target.roles?.highest
    && target.roles.highest.comparePositionTo(actorHighest) >= 0) {
    throw new Error('You cannot moderate a member with an equal or higher role.');
  }

  const botMember = interaction.guild.members.me;
  if (!botMember || target.roles?.highest?.comparePositionTo(botMember.roles.highest) >= 0) {
    throw new Error('Mort cannot moderate that member because their highest role is above or equal to Mort.');
  }
}

module.exports = {
  PRIVILEGED_ROLE_PERMISSIONS,
  configuredOwnerIds,
  isOwnerAllowed,
  requireOwner,
  requireGuild,
  requirePermission,
  requireManageGuild,
  requireGuildOwnerOrConfiguredOwner,
  requireModerator,
  canBotManageRole,
  isPrivilegedRole,
  assertSafeAssignableRole,
  assertCanModerateTarget
};
