const { SlashCommandBuilder } = require('discord.js');
const { getGuild, updateGuild } = require('../../services/dataStore');
const { themedEmbed } = require('../../utils/theme');
const { COLORS } = require('../../config/blueprint');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work to earn some coins.'),
  async execute(interaction) {
    const memory = getGuild(interaction.guild.id);
    const lastWork = memory.economy?.[interaction.user.id]?.lastWork || 0;
    const now = Date.now();
    const cooldown = 1000 * 60 * 60; // 1 hour

    if (now - lastWork < cooldown) {
      const remaining = Math.ceil((cooldown - (now - lastWork)) / 1000 / 60);
      return interaction.reply({ ephemeral: true, content: `You need to rest! Come back in ${remaining} minutes.` });
    }

    const earnings = Math.floor(Math.random() * 500) + 100;
    
    updateGuild(interaction.guild.id, (guild) => {
      if (!guild.economy) guild.economy = {};
      if (!guild.economy[interaction.user.id]) guild.economy[interaction.user.id] = { balance: 0, bank: 0 };
      guild.economy[interaction.user.id].balance += earnings;
      guild.economy[interaction.user.id].lastWork = now;
    });

    return interaction.reply({
      embeds: [themedEmbed({
        title: '💼 Work Complete',
        description: `You worked hard and earned **${earnings} coins**!`,
        color: COLORS.success
      })]
    });
  }
};
