const { SlashCommandBuilder } = require('discord.js');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a lightweight reminder while Mort is online.')
    .addIntegerOption((opt) => opt.setName('minutes').setDescription('Minutes from now.').setMinValue(1).setMaxValue(1440).setRequired(true))
    .addStringOption((opt) => opt.setName('text').setDescription('Reminder text.').setMaxLength(500).setRequired(true)),
  async execute(interaction) {
    const minutes = interaction.options.getInteger('minutes', true);
    const text = interaction.options.getString('text', true);
    await interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '⏰ Reminder Set', description: `I will remind you in **${minutes} minute(s)**.\n\n${text}`, color: COLORS.success })] });
    setTimeout(() => {
      interaction.user.send({ embeds: [themedEmbed({ title: '⏰ Mort Reminder', description: text, color: COLORS.royalPurple })] }).catch(() => {
        interaction.channel?.send({ content: `<@${interaction.user.id}>`, embeds: [themedEmbed({ title: '⏰ Mort Reminder', description: text, color: COLORS.royalPurple })] }).catch(() => null);
      });
    }, minutes * 60 * 1000);
  }
};
