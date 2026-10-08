const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { themedEmbed } = require('../../utils/theme');
const { COLORS } = require('../../config/blueprint');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Start a giveaway in the current channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt => opt.setName('prize').setDescription('What are you giving away?').setRequired(true))
    .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in minutes').setMinValue(1).setRequired(true))
    .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20).setRequired(false)),
  async execute(interaction) {
    const prize = interaction.options.getString('prize');
    const duration = interaction.options.getInteger('duration');
    const winnerCount = interaction.options.getInteger('winners') || 1;
    const endTime = Date.now() + (duration * 60 * 1000);
    
    const embed = themedEmbed({
      title: '🎉 GIVEAWAY 🎉',
      description: `**Prize:** ${prize}\n**Winners:** ${winnerCount}\n**Ends:** <t:${Math.floor(endTime / 1000)}:R>\n\nReact with 🎉 to enter!`,
      color: COLORS.pink
    });
    
    const message = await interaction.reply({ embeds: [embed], fetchReply: true });
    await message.react('🎉');
    
    setTimeout(async () => {
      try {
        const fetchedMessage = await interaction.channel.messages.fetch(message.id);
        const reaction = fetchedMessage.reactions.cache.get('🎉');
        if (!reaction) return;
        
        const users = await reaction.users.fetch();
        const validUsers = users.filter(u => !u.bot).map(u => u);
        
        if (validUsers.length === 0) {
          return interaction.channel.send(`No one entered the giveaway for **${prize}**!`);
        }
        
        const actualWinners = Math.min(winnerCount, validUsers.length);
        const winners = [];
        
        for (let i = 0; i < actualWinners; i++) {
          const index = Math.floor(Math.random() * validUsers.length);
          winners.push(validUsers[index]);
          validUsers.splice(index, 1);
        }
        
        interaction.channel.send(`Congratulations ${winners.map(w => `<@${w.id}>`).join(', ')}! You won **${prize}**!`);
      } catch (e) {
        console.error('Giveaway error:', e);
      }
    }, duration * 60 * 1000);
  }
};
