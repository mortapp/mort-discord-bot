const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { verifyPanel } = require('../services/panelService');
const { getGuild } = require('../services/dataStore');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { requireManageGuild } = require('../utils/guards');
const { sendVerifiedWelcome } = require('../services/welcomeService');

async function verifyMember(interaction, member) {
  const memory = getGuild(interaction.guild.id);
  const verifiedRoleId = memory.config?.verifiedRoleId || memory.roles?.verified;
  const memberRoleId = memory.config?.memberRoleId || memory.roles?.member;
  const unverifiedRoleId = memory.config?.unverifiedRoleId || memory.roles?.unverified;
  const verifiedRole = verifiedRoleId ? await interaction.guild.roles.fetch(verifiedRoleId).catch(() => null) : null;
  const memberRole = memberRoleId ? await interaction.guild.roles.fetch(memberRoleId).catch(() => null) : null;
  const unverifiedRole = unverifiedRoleId ? await interaction.guild.roles.fetch(unverifiedRoleId).catch(() => null) : null;
  if (!verifiedRole || !memberRole) throw new Error('Mort cannot find the Member/Verified roles. Run /setup repair.');
  await member.roles.add([verifiedRole, memberRole], 'Mort manual verify');
  if (unverifiedRole) await member.roles.remove(unverifiedRole, 'Mort manual verify').catch(() => null);
  await sendVerifiedWelcome(member).catch(() => null);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Mort verification panel and manual verify tools.')
    .addSubcommand((sub) => sub
      .setName('panel')
      .setDescription('Send the verify panel.')
      .addChannelOption((opt) => opt.setName('channel').setDescription('Where to send it. Defaults to current channel.').addChannelTypes(ChannelType.GuildText).setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('force')
      .setDescription('Manually verify a member.')
      .addUserOption((opt) => opt.setName('user').setDescription('Member to verify.').setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    requireManageGuild(interaction);

    if (subcommand === 'panel') {
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      await channel.send(verifyPanel());
      return interaction.reply({ ephemeral: true, content: `✅ Verify panel sent to ${channel}.` });
    }

    if (subcommand === 'force') {
      const user = interaction.options.getUser('user', true);
      const member = await interaction.guild.members.fetch(user.id);
      await verifyMember(interaction, member);
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '✅ Member Verified', description: `${member} now has Member + Verified.`, color: COLORS.success })] });
    }

    return null;
  }
};
