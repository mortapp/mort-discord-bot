const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { mainPanel } = require('../services/panelService');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { requireManageGuild } = require('../utils/guards');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Send Mort control panels.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('send')
      .setDescription('Send the main Mort control panel in this channel.')),

  async execute(interaction) {
    requireManageGuild(interaction);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'send') {
      await interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '✦ Sending Mort Panel', description: 'Panel deployed in this channel.', color: COLORS.lightBlue })] });
      await interaction.channel.send(mainPanel());
    }
  }
};
