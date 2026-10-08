const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { updateGuild } = require('../../services/dataStore');
const { themedEmbed } = require('../../utils/theme');
const { COLORS } = require('../../config/blueprint');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('starboard')
    .setDescription('Configure the starboard system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Set the starboard channel and threshold.')
      .addChannelOption(opt => opt.setName('channel').setDescription('Starboard channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addIntegerOption(opt => opt.setName('threshold').setDescription('Stars required').setMinValue(1).setMaxValue(50).setRequired(true))),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const threshold = interaction.options.getInteger('threshold');
    
    updateGuild(interaction.guild.id, (guild) => {
      guild.config.starboardChannelId = channel.id;
      guild.config.starboardThreshold = threshold;
    });
    
    return interaction.reply({
      embeds: [themedEmbed({
        title: '⭐ Starboard Configured',
        description: `Starboard channel set to ${channel}\nThreshold: **${threshold}** stars`,
        color: COLORS.gold
      })]
    });
  }
};
