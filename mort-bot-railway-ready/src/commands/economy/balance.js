const { SlashCommandBuilder } = require('discord.js');
const { getGuild } = require('../../services/dataStore');
const { themedEmbed } = require('../../utils/theme');
const { COLORS } = require('../../config/blueprint');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription("Check your or another user's balance.")
    .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const memory = getGuild(interaction.guild.id);
    const balance = memory.economy?.[user.id]?.balance || 0;
    const bank = memory.economy?.[user.id]?.bank || 0;
    
    return interaction.reply({
      embeds: [themedEmbed({
        title: `💰 ${user.username}'s Balance`,
        description: `**Wallet:** ${balance} coins\n**Bank:** ${bank} coins\n**Total:** ${balance + bank} coins`,
        color: COLORS.gold
      })]
    });
  }
};
