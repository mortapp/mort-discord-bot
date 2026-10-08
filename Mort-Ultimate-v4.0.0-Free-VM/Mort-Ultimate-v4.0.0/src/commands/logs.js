const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { getGuild, updateGuild } = require('../services/dataStore');
const { requireManageGuild } = require('../utils/guards');
const { sendLog } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Configure Mort log routing.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('channel')
      .setDescription('Set Mort log channel.')
      .addChannelOption((opt) => opt.setName('channel').setDescription('Private staff log channel.').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((sub) => sub.setName('status').setDescription('Show current log channel.'))
    .addSubcommand((sub) => sub.setName('test').setDescription('Send a test log.')),

  async execute(interaction) {
    requireManageGuild(interaction);
    const sub = interaction.options.getSubcommand();
    const memory = getGuild(interaction.guild.id);

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel', true);
      updateGuild(interaction.guild.id, (guild) => {
        guild.config.logChannelId = channel.id;
        guild.channels.modLogs = channel.id;
      });
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🧾 Log Channel Updated', description: `Mort logs will go to ${channel}.`, color: COLORS.success })] });
    }

    if (sub === 'status') {
      const logId = memory.config?.logChannelId || memory.channels?.modLogs;
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🧾 Mort Logs', description: logId ? `Current log channel: <#${logId}>` : 'No log channel set. Run `/logs channel`.', color: COLORS.lightBlue })] });
    }

    if (sub === 'test') {
      await sendLog(interaction.guild, memory, '🧾 Mort Test Log', `Test log sent by ${interaction.user}.`, COLORS.royalPurple);
      return interaction.reply({ ephemeral: true, content: '✅ Test log sent.' });
    }
  }
};
