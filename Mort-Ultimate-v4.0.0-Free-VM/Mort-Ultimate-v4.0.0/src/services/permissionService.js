const { PermissionFlagsBits } = require('discord.js');
const { COLORS } = require('../config/blueprint');
const { themedEmbed } = require('../utils/theme');
const { getGuild } = require('./dataStore');

const REQUIRED_PERMISSIONS = [
  ['Administrator', PermissionFlagsBits.Administrator, 'Best setup option while Mort is configuring the server.'],
  ['Manage Roles', PermissionFlagsBits.ManageRoles, 'Required to give Member/Verified and remove Unverified.'],
  ['Manage Channels', PermissionFlagsBits.ManageChannels, 'Required to lock/unlock verify channels and repair categories.'],
  ['View Channels', PermissionFlagsBits.ViewChannel, 'Required to see Mort-managed channels.'],
  ['Send Messages', PermissionFlagsBits.SendMessages, 'Required to reply, post panels, and send setup logs.'],
  ['Embed Links', PermissionFlagsBits.EmbedLinks, 'Required for clean Mort cards.'],
  ['Read Message History', PermissionFlagsBits.ReadMessageHistory, 'Required for panels and support flows.'],
  ['Use Application Commands', PermissionFlagsBits.UseApplicationCommands, 'Required for slash command support.']
];

function highestRoleName(member) {
  return member?.roles?.highest?.name || '@none';
}

function canManageRole(botMember, role) {
  if (!role || !botMember) return false;
  if (role.managed) return false;
  return botMember.roles.highest.comparePositionTo(role) > 0;
}

async function resolveMortMember(guild) {
  const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
  return me;
}

async function diagnosePermissions(guild) {
  const me = await resolveMortMember(guild);
  if (!me) {
    return {
      healthy: false,
      missing: ['Bot member could not be fetched'],
      hierarchyProblems: [],
      botRole: '@missing',
      hasAdministrator: false
    };
  }

  const perms = me.permissions;
  const hasAdministrator = perms.has(PermissionFlagsBits.Administrator);
  const missing = REQUIRED_PERMISSIONS
    .filter(([name, bit]) => !perms.has(bit))
    .map(([name]) => name);

  const memory = getGuild(guild.id);
  const targetRoleIds = [
    memory.config?.verifiedRoleId || memory.roles?.verified,
    memory.config?.memberRoleId || memory.roles?.member,
    memory.config?.unverifiedRoleId || memory.roles?.unverified,
    memory.roles?.muted,
    memory.roles?.vip,
    memory.roles?.betaTester
  ].filter(Boolean);

  const hierarchyProblems = [];
  for (const roleId of targetRoleIds) {
    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (role && !canManageRole(me, role)) {
      hierarchyProblems.push(role.name);
    }
  }

  return {
    healthy: (hasAdministrator || missing.length === 0) && hierarchyProblems.length === 0,
    missing: hasAdministrator ? [] : missing,
    hierarchyProblems,
    botRole: highestRoleName(me),
    hasAdministrator
  };
}

function permissionFixText(report) {
  const lines = [];
  if (report.hasAdministrator && report.hierarchyProblems.length === 0) {
    lines.push('Mort has Administrator and the role hierarchy looks good.');
  }
  if (report.missing.length) {
    lines.push(`Missing permissions: **${report.missing.join(', ')}**.`);
  }
  if (report.hierarchyProblems.length) {
    lines.push(`Role hierarchy issue: Mort cannot manage **${report.hierarchyProblems.join(', ')}**.`);
    lines.push('Fix: go to **Server Settings → Roles** and drag Mort above those roles.');
  }
  lines.push(`Mort highest role: **${report.botRole}**.`);
  return lines.join('\n');
}

function permissionReportEmbed(report) {
  return themedEmbed({
    title: report.healthy ? '✅ Mort Permissions Healthy' : '⚠️ Mort Permission Fix Needed',
    description: permissionFixText(report),
    color: report.healthy ? COLORS.success : COLORS.warning
  });
}

function missingPermissionMessage(error) {
  const raw = String(error?.message || error || '').toLowerCase();
  if (!raw.includes('missing permissions') && !raw.includes('missing access') && !raw.includes('permissions')) return null;
  return [
    'Mort is missing Discord permissions for that action.',
    '',
    '**Fast fix:** Server Settings → Roles → drag Mort above Member/Verified/Unverified, then give Mort **Manage Roles** and **Manage Channels**.',
    'Easiest setup mode: give Mort **Administrator** while setting up, then run `/mort doctor`.'
  ].join('\n');
}

module.exports = {
  REQUIRED_PERMISSIONS,
  diagnosePermissions,
  permissionReportEmbed,
  permissionFixText,
  missingPermissionMessage,
  canManageRole
};
