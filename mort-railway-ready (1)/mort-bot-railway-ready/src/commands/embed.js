const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { requireManageGuild } = require('../utils/guards');

function parseColor(input) {
  if (!input) return COLORS.royalPurple;
  const normalized = input.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return COLORS.royalPurple;
  return Number.parseInt(normalized, 16);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create clean Mort-style embeds.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('send')
      .setDescription('Send a custom embed.')
      .addStringOption((opt) => opt.setName('title').setDescription('Embed title.').setMaxLength(120).setRequired(true))
      .addStringOption((opt) => opt.setName('description').setDescription('Embed description.').setMaxLength(2000).setRequired(true))
      .addChannelOption((opt) => opt.setName('channel').setDescription('Where to send it. Defaults to current channel.').addChannelTypes(ChannelType.GuildText).setRequired(false))
      .addStringOption((opt) => opt.setName('color').setDescription('Hex color like #7c3aed.').setRequired(false))),

  async execute(interaction) {
    requireManageGuild(interaction);
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const color = parseColor(interaction.options.getString('color'));
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    await channel.send({ embeds: [themedEmbed({ title, description, color })] });
    return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '✅ Embed Sent', description: `Sent to ${channel}.`, color: COLORS.success })] });
  }
};
