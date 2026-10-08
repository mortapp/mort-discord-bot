const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { requirePermission, assertCanModerateTarget } = require('../utils/guards');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { getGuild, updateGuild, addWarning, getWarnings, removeWarning } = require('../services/dataStore');
const { sendLog } = require('../utils/logger');
const { applyEscalation } = require('../utils/escalation');

const PERMISSIONS = {
  timeout: [PermissionFlagsBits.ModerateMembers, 'Timeout Members'],
  kick: [PermissionFlagsBits.KickMembers, 'Kick Members'],
  ban: [PermissionFlagsBits.BanMembers, 'Ban Members'],
  unban: [PermissionFlagsBits.BanMembers, 'Ban Members'],
  purge: [PermissionFlagsBits.ManageMessages, 'Manage Messages'],
  clear: [PermissionFlagsBits.ManageMessages, 'Manage Messages'],
  slowmode: [PermissionFlagsBits.ManageChannels, 'Manage Channels'],
  lock: [PermissionFlagsBits.ManageChannels, 'Manage Channels'],
  unlock: [PermissionFlagsBits.ManageChannels, 'Manage Channels'],
  warn: [PermissionFlagsBits.ModerateMembers, 'Timeout Members'],
  warnings: [PermissionFlagsBits.ModerateMembers, 'Timeout Members'],
  delwarn: [PermissionFlagsBits.ModerateMembers, 'Timeout Members'],
  userinfo: [PermissionFlagsBits.ModerateMembers, 'Timeout Members'],
  serverinfo: [PermissionFlagsBits.ModerateMembers, 'Timeout Members']
};

function permissionState(overwrite, permission) {
  if (!overwrite) return null;
  if (overwrite.allow.has(permission)) return true;
  if (overwrite.deny.has(permission)) return false;
  return null;
}

async function resolveTarget(interaction) {
  const user = interaction.options.getUser('user', true);
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  assertCanModerateTarget(interaction, member);
  return { user, member };
}

async function setChannelLock(interaction, locked) {
  const channel = interaction.channel;
  if (!channel?.permissionOverwrites?.edit) throw new Error('This channel cannot be locked by Mort.');
  const guildId = interaction.guild.id;
  const everyoneId = interaction.guild.roles.everyone.id;
  const memory = getGuild(guildId);

  if (locked) {
    if (memory.channelLocks?.[channel.id]) return { changed: false };
    const existing = channel.permissionOverwrites.cache.get(everyoneId);
    updateGuild(guildId, (guild) => {
      guild.channelLocks[channel.id] = {
        sendMessages: permissionState(existing, PermissionFlagsBits.SendMessages),
        lockedAt: new Date().toISOString(),
        lockedBy: interaction.user.id
      };
    });
    await channel.permissionOverwrites.edit(everyoneId, { SendMessages: false }, { reason: 'Mort channel lock' });
    return { changed: true };
  }

  const snapshot = memory.channelLocks?.[channel.id];
  if (!snapshot) return { changed: false, missingSnapshot: true };
  await channel.permissionOverwrites.edit(everyoneId, { SendMessages: snapshot.sendMessages }, { reason: 'Mort channel unlock restore' });
  updateGuild(guildId, (guild) => { delete guild.channelLocks[channel.id]; });
  return { changed: true };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Mort moderation tools.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) => sub.setName('timeout').setDescription('Timeout a member.').addUserOption((opt) => opt.setName('user').setDescription('Member to timeout.').setRequired(true)).addIntegerOption((opt) => opt.setName('minutes').setDescription('Timeout length in minutes.').setMinValue(1).setMaxValue(10080).setRequired(true)).addStringOption((opt) => opt.setName('reason').setDescription('Reason.').setMaxLength(500).setRequired(false)))
    .addSubcommand((sub) => sub.setName('kick').setDescription('Kick a member.').addUserOption((opt) => opt.setName('user').setDescription('Member to kick.').setRequired(true)).addStringOption((opt) => opt.setName('reason').setDescription('Reason.').setMaxLength(500).setRequired(false)))
    .addSubcommand((sub) => sub.setName('ban').setDescription('Ban a current member.').addUserOption((opt) => opt.setName('user').setDescription('Member to ban.').setRequired(true)).addStringOption((opt) => opt.setName('reason').setDescription('Reason.').setMaxLength(500).setRequired(false)))
    .addSubcommand((sub) => sub.setName('unban').setDescription('Unban a user by ID.').addStringOption((opt) => opt.setName('user_id').setDescription('Discord user ID to unban.').setRequired(true)).addStringOption((opt) => opt.setName('reason').setDescription('Reason.').setMaxLength(500).setRequired(false)))
    .addSubcommand((sub) => sub.setName('purge').setDescription('Delete recent messages from this channel.').addIntegerOption((opt) => opt.setName('amount').setDescription('Number of messages, max 100.').setMinValue(1).setMaxValue(100).setRequired(true)))
    .addSubcommand((sub) => sub.setName('clear').setDescription('Alias for purge.').addIntegerOption((opt) => opt.setName('amount').setDescription('Number of messages, max 100.').setMinValue(1).setMaxValue(100).setRequired(true)))
    .addSubcommand((sub) => sub.setName('slowmode').setDescription('Set channel slowmode.').addIntegerOption((opt) => opt.setName('seconds').setDescription('0 disables.').setMinValue(0).setMaxValue(21600).setRequired(true)))
    .addSubcommand((sub) => sub.setName('lock').setDescription('Lock this channel for regular members.'))
    .addSubcommand((sub) => sub.setName('unlock').setDescription('Restore this channel’s pre-lock send permission.'))
    .addSubcommand((sub) => sub.setName('warn').setDescription('Warn a member. Warnings escalate automatically.').addUserOption((opt) => opt.setName('user').setDescription('Member to warn.').setRequired(true)).addStringOption((opt) => opt.setName('reason').setDescription('Reason.').setMaxLength(500).setRequired(true)))
    .addSubcommand((sub) => sub.setName('warnings').setDescription("View a member's warning history.").addUserOption((opt) => opt.setName('user').setDescription('Member to look up.').setRequired(true)))
    .addSubcommand((sub) => sub.setName('delwarn').setDescription('Remove a specific warning by case number.').addUserOption((opt) => opt.setName('user').setDescription('Member the warning belongs to.').setRequired(true)).addIntegerOption((opt) => opt.setName('case').setDescription('Case number to remove.').setMinValue(1).setRequired(true)))
    .addSubcommand((sub) => sub.setName('userinfo').setDescription('Show user moderation info.').addUserOption((opt) => opt.setName('user').setDescription('User to inspect.').setRequired(false)))
    .addSubcommand((sub) => sub.setName('serverinfo').setDescription('Show server moderation info.')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const [permission, label] = PERMISSIONS[subcommand];
    requirePermission(interaction, permission, label);
    const memory = getGuild(interaction.guild.id);

    if (subcommand === 'timeout') {
      const { user, member } = await resolveTarget(interaction);
      if (!member.moderatable) throw new Error('Mort cannot timeout that member because of Discord permissions or role hierarchy.');
      const minutes = interaction.options.getInteger('minutes', true);
      const reason = interaction.options.getString('reason') || 'No reason provided.';
      await member.timeout(minutes * 60 * 1000, reason);
      await sendLog(interaction.guild, memory, '⏳ Member Timed Out', `<@${user.id}> was timed out for ${minutes} minute(s).\nReason: ${reason}`, COLORS.warning);
      return interaction.reply({ embeds: [themedEmbed({ title: '⏳ Timeout Applied', description: `<@${user.id}> is timed out for **${minutes}** minute(s).`, color: COLORS.warning })] });
    }

    if (subcommand === 'kick') {
      const { user, member } = await resolveTarget(interaction);
      if (!member.kickable) throw new Error('Mort cannot kick that member because of Discord permissions or role hierarchy.');
      const reason = interaction.options.getString('reason') || 'No reason provided.';
      await member.kick(reason);
      await sendLog(interaction.guild, memory, '👢 Member Kicked', `<@${user.id}> was kicked.\nReason: ${reason}`, COLORS.warning);
      return interaction.reply({ embeds: [themedEmbed({ title: '👢 Member Kicked', description: `<@${user.id}> was kicked.`, color: COLORS.warning })] });
    }

    if (subcommand === 'ban') {
      const { user, member } = await resolveTarget(interaction);
      if (!member.bannable) throw new Error('Mort cannot ban that member because of Discord permissions or role hierarchy.');
      const reason = interaction.options.getString('reason') || 'No reason provided.';
      await member.ban({ reason });
      await sendLog(interaction.guild, memory, '🔨 Member Banned', `<@${user.id}> was banned.\nReason: ${reason}`, COLORS.danger);
      return interaction.reply({ embeds: [themedEmbed({ title: '🔨 Member Banned', description: `<@${user.id}> was banned.`, color: COLORS.danger })] });
    }

    if (subcommand === 'unban') {
      const userId = interaction.options.getString('user_id', true).trim();
      if (!/^\d{17,20}$/.test(userId)) throw new Error('Enter a valid Discord user ID.');
      const reason = interaction.options.getString('reason') || 'No reason provided.';
      await interaction.guild.members.unban(userId, reason);
      await sendLog(interaction.guild, memory, '🔓 Member Unbanned', `<@${userId}> (\`${userId}\`) was unbanned.\nReason: ${reason}`, COLORS.success);
      return interaction.reply({ embeds: [themedEmbed({ title: '🔓 Member Unbanned', description: `\`${userId}\` was unbanned.`, color: COLORS.success })] });
    }

    if (subcommand === 'purge' || subcommand === 'clear') {
      if (!interaction.channel?.bulkDelete) throw new Error('Mort can only purge messages in a text channel.');
      const amount = interaction.options.getInteger('amount', true);
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await sendLog(interaction.guild, memory, '🧹 Messages Cleared', `${deleted.size} messages were deleted in ${interaction.channel} by <@${interaction.user.id}>.`, COLORS.warning);
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🧹 Clear Complete', description: `Deleted **${deleted.size}** messages. Messages older than 14 days are skipped by Discord.`, color: COLORS.success })] });
    }

    if (subcommand === 'slowmode') {
      if (!interaction.channel?.setRateLimitPerUser) throw new Error('Mort can only set slowmode in a text channel.');
      const seconds = interaction.options.getInteger('seconds', true);
      await interaction.channel.setRateLimitPerUser(seconds, 'Mort slowmode command');
      return interaction.reply({ embeds: [themedEmbed({ title: '🐢 Slowmode Updated', description: seconds ? `Slowmode set to **${seconds}s**.` : 'Slowmode disabled.', color: COLORS.lightBlue })] });
    }

    if (subcommand === 'lock' || subcommand === 'unlock') {
      const result = await setChannelLock(interaction, subcommand === 'lock');
      const description = subcommand === 'lock'
        ? (result.changed ? 'Regular members cannot send messages here now. Mort recorded the prior permission for a safe restore.' : 'This channel is already locked by Mort.')
        : (result.changed ? 'Mort restored this channel’s pre-lock send permission.' : 'No Mort lock snapshot exists for this channel, so nothing was changed.');
      return interaction.reply({ embeds: [themedEmbed({ title: subcommand === 'lock' ? '🔒 Channel Locked' : '🔓 Channel Unlocked', description, color: subcommand === 'lock' ? COLORS.warning : COLORS.success })] });
    }

    if (subcommand === 'warn') {
      const { user, member } = await resolveTarget(interaction);
      const reason = interaction.options.getString('reason', true);
      const entry = addWarning(interaction.guild.id, user.id, { moderatorId: interaction.user.id, reason, source: 'manual' });
      const count = getWarnings(interaction.guild.id, user.id).length;
      await sendLog(interaction.guild, memory, '⚠️ Member Warned', `<@${user.id}> was warned by <@${interaction.user.id}> (case #${entry.case}).\nReason: ${reason}\nTotal warnings: ${count}`, COLORS.warning);
      const escalationResult = await applyEscalation(interaction.guild, memory, member, count).catch(() => null);
      return interaction.reply({ embeds: [themedEmbed({ title: '⚠️ Warning Issued', description: [`<@${user.id}> was warned. (Case #${entry.case}, total: **${count}**)`, `Reason: ${reason}`, escalationResult ? `Auto-escalation: ${escalationResult}` : null].filter(Boolean).join('\n'), color: COLORS.warning })] });
    }

    if (subcommand === 'warnings') {
      const user = interaction.options.getUser('user', true);
      const history = getWarnings(interaction.guild.id, user.id);
      if (!history.length) return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '📋 Warning History', description: `<@${user.id}> has no warnings.`, color: COLORS.lightBlue })] });
      const lines = history.slice(-10).reverse().map((entry) => `**#${entry.case}** — ${entry.reason} *(by <@${entry.moderatorId}>, ${new Date(entry.at).toLocaleDateString()})*`);
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: `📋 Warning History (${history.length} total)`, description: lines.join('\n'), color: COLORS.royalPurple })] });
    }

    if (subcommand === 'delwarn') {
      const user = interaction.options.getUser('user', true);
      const caseId = interaction.options.getInteger('case', true);
      const removed = removeWarning(interaction.guild.id, user.id, caseId);
      if (!removed) return interaction.reply({ ephemeral: true, content: `No warning with case #${caseId} found for <@${user.id}>.` });
      await sendLog(interaction.guild, memory, '🗑️ Warning Removed', `Case #${caseId} for <@${user.id}> was removed by <@${interaction.user.id}>.`, COLORS.lightBlue);
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🗑️ Warning Removed', description: `Removed case #${caseId} for <@${user.id}>.`, color: COLORS.success })] });
    }

    if (subcommand === 'userinfo') {
      const user = interaction.options.getUser('user') || interaction.user;
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      const warnings = getWarnings(interaction.guild.id, user.id).length;
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '👤 User Info', description: [`User: ${user}`, `ID: \`${user.id}\``, `Created: <t:${Math.floor(user.createdTimestamp / 1000)}:R>`, member ? `Joined: <t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Not in server', member ? `Highest role: **${member.roles.highest.name}**` : null, `Warnings: **${warnings}**`].filter(Boolean).join('\n'), color: COLORS.lightBlue })] });
    }

    return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🏠 Server Info', description: [`Name: **${interaction.guild.name}**`, `ID: \`${interaction.guild.id}\``, `Members: **${interaction.guild.memberCount}**`, `Roles: **${interaction.guild.roles.cache.size}**`, `Channels: **${interaction.guild.channels.cache.size}**`, `Created: <t:${Math.floor(interaction.guild.createdTimestamp / 1000)}:R>`].join('\n'), color: COLORS.royalPurple })] });
  }
};
