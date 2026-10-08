const { SlashCommandBuilder } = require('discord.js');
const { themedEmbed } = require('../../utils/theme');
const { COLORS } = require('../../config/blueprint');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View server statistics.'),
  async execute(interaction) {
    const guild = interaction.guild;
    const members = guild.memberCount;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = members - bots;
    const channels = guild.channels.cache.size;
    const roles = guild.roles.cache.size;
    const boostCount = guild.premiumSubscriptionCount || 0;
    const boostTier = guild.premiumTier;
    
    return interaction.reply({
      embeds: [themedEmbed({
        title: `📊 ${guild.name} Statistics`,
        description: `Server created: <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
        fields: [
          { name: '👥 Members', value: `Total: ${members}\nHumans: ${humans}\nBots: ${bots}`, inline: true },
          { name: '📁 Channels', value: `Total: ${channels}`, inline: true },
          { name: '🎭 Roles', value: `Total: ${roles}`, inline: true },
          { name: '✨ Boosts', value: `Level: ${boostTier}\nBoosts: ${boostCount}`, inline: true }
        ],
        color: COLORS.lightBlue
      }).setThumbnail(guild.iconURL({ dynamic: true }))]
    });
  }
};
