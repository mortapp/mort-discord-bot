const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { verifyPanel } = require('../services/panelService');
const { getGuild, updateGuild } = require('../services/dataStore');
const { setupServer, diagnose } = require('../services/setupService');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { requireManageGuild } = require('../utils/guards');
const { sendVerifiedWelcome } = require('../services/welcomeService');
const { diagnosePermissions, permissionFixText, canManageRole } = require('../services/permissionService');

async function verifyMember(interaction, member) {
  const memory = getGuild(interaction.guild.id);
  const verifiedRoleId = memory.config?.verifiedRoleId || memory.roles?.verified;
  const memberRoleId = memory.config?.memberRoleId || memory.roles?.member;
  const unverifiedRoleId = memory.config?.unverifiedRoleId || memory.roles?.unverified;
  const verifiedRole = verifiedRoleId ? await interaction.guild.roles.fetch(verifiedRoleId).catch(() => null) : null;
  const memberRole = memberRoleId ? await interaction.guild.roles.fetch(memberRoleId).catch(() => null) : null;
  const unverifiedRole = unverifiedRoleId ? await interaction.guild.roles.fetch(unverifiedRoleId).catch(() => null) : null;
  if (!verifiedRole || !memberRole) throw new Error('Mort cannot find the Member/Verified roles. Run /setup fix or /verify repair.');

  const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
  const blocked = [verifiedRole, memberRole, unverifiedRole].filter(Boolean).filter((role) => !canManageRole(botMember, role));
  if (blocked.length) {
    throw new Error(`Mort cannot manage ${blocked.map((role) => role.name).join(', ')}. Drag Mort's role above those roles in Server Settings → Roles.`);
  }

  await member.roles.add([verifiedRole, memberRole], 'Mort manual verify');
  if (unverifiedRole) await member.roles.remove(unverifiedRole, 'Mort manual verify').catch(() => null);
  await sendVerifiedWelcome(member).catch(() => null);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Mort verification panel and manual verify tools.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('panel')
      .setDescription('Send the verify panel.')
      .addChannelOption((opt) => opt.setName('channel').setDescription('Where to send it. Defaults to current channel.').addChannelTypes(ChannelType.GuildText).setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('force')
      .setDescription('Manually verify a member.')
      .addUserOption((opt) => opt.setName('user').setDescription('Member to verify.').setRequired(true)))
    .addSubcommand((sub) => sub.setName('repair').setDescription('Repair verify roles, channel permissions, and send a fresh panel.'))
    .addSubcommand((sub) => sub.setName('status').setDescription('Check verify role/channel/button readiness.'))
    .addSubcommand((sub) => sub.setName('reset').setDescription('Reset the verify panel in the saved verify channel.')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    requireManageGuild(interaction);

    if (subcommand === 'panel') {
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      await channel.send(verifyPanel());
      updateGuild(interaction.guild.id, (guild) => {
        if (!guild.channels) guild.channels = {};
        guild.channels.verify = channel.id;
        if (!guild.config) guild.config = {};
        guild.config.verifyChannelId = channel.id;
      });
      return interaction.reply({ ephemeral: true, content: `✅ Verify panel sent to ${channel}.` });
    }

    if (subcommand === 'force') {
      const user = interaction.options.getUser('user', true);
      const member = await interaction.guild.members.fetch(user.id);
      await verifyMember(interaction, member);
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '✅ Member Verified', description: `${member} now has Member + Verified.`, color: COLORS.success })] });
    }

    if (subcommand === 'repair') {
      await interaction.deferReply({ ephemeral: true });
      await setupServer(interaction.guild);
      const memory = getGuild(interaction.guild.id);
      const channelId = memory.config?.verifyChannelId || memory.channels?.verify;
      const channel = channelId ? await interaction.guild.channels.fetch(channelId).catch(() => null) : null;
      if (channel?.isTextBased?.()) await channel.send(verifyPanel()).catch(() => null);
      const permissionReport = await diagnosePermissions(interaction.guild);
      return interaction.editReply({ embeds: [themedEmbed({
        title: '✅ Verify System Repaired',
        description: [
          `Verify channel: ${channel ? `${channel}` : 'missing'}`,
          `Member role: ${memory.roles?.member ? `<@&${memory.roles.member}>` : 'missing'}`,
          `Verified role: ${memory.roles?.verified ? `<@&${memory.roles.verified}>` : 'missing'}`,
          `Unverified role: ${memory.roles?.unverified ? `<@&${memory.roles.unverified}>` : 'missing'}`,
          '',
          permissionFixText(permissionReport)
        ].join('\n'),
        color: permissionReport.healthy ? COLORS.success : COLORS.warning
      })] });
    }

    if (subcommand === 'status') {
      const [setupReport, permissionReport] = await Promise.all([diagnose(interaction.guild), diagnosePermissions(interaction.guild)]);
      const memory = getGuild(interaction.guild.id);
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({
        title: '✅ Verify Status',
        description: [
          `Setup: **${setupReport.healthy ? 'Healthy' : 'Needs repair'}**`,
          `Verify channel: ${memory.channels?.verify ? `<#${memory.channels.verify}>` : 'missing'}`,
          `Member role: ${memory.roles?.member ? `<@&${memory.roles.member}>` : 'missing'}`,
          `Verified role: ${memory.roles?.verified ? `<@&${memory.roles.verified}>` : 'missing'}`,
          `Unverified role: ${memory.roles?.unverified ? `<@&${memory.roles.unverified}>` : 'missing'}`,
          '',
          permissionFixText(permissionReport)
        ].join('\n'),
        color: setupReport.healthy && permissionReport.healthy ? COLORS.success : COLORS.warning
      })] });
    }

    if (subcommand === 'reset') {
      const memory = getGuild(interaction.guild.id);
      const channelId = memory.config?.verifyChannelId || memory.channels?.verify;
      const channel = channelId ? await interaction.guild.channels.fetch(channelId).catch(() => null) : null;
      if (!channel?.isTextBased?.()) return interaction.reply({ ephemeral: true, content: 'Verify channel is missing. Run `/verify repair`.' });
      await channel.send(verifyPanel());
      return interaction.reply({ ephemeral: true, content: `✅ Fresh Verify Me panel sent to ${channel}.` });
    }

    return null;
  }
};
