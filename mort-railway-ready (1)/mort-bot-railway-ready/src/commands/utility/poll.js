const { SlashCommandBuilder } = require('discord.js');
const { themedEmbed } = require('../../utils/theme');
const { COLORS } = require('../../config/blueprint');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a simple yes/no poll.')
    .addStringOption(opt => opt.setName('question').setDescription('The question to ask').setRequired(true)),
  async execute(interaction) {
    const question = interaction.options.getString('question');
    
    const embed = themedEmbed({
      title: '📊 Poll',
      description: `**${question}**\n\nReact below to vote!`,
      color: COLORS.lightBlue
    });
    
    const message = await interaction.reply({ embeds: [embed], fetchReply: true });
    await message.react('👍');
    await message.react('👎');
  }
};
