const { SlashCommandBuilder } = require('discord.js');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Show a member avatar.')
    .addUserOption((opt) => opt.setName('user').setDescription('Member to inspect.').setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const url = user.displayAvatarURL({ size: 1024, extension: 'png' });
    return interaction.reply({ embeds: [themedEmbed({ title: `🖼️ ${user.username}'s Avatar`, description: `[Open full image](${url})`, color: COLORS.lightBlue }).setImage(url)] });
  }
};
