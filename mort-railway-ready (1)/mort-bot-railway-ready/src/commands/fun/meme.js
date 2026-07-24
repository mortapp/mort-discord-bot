const { SlashCommandBuilder } = require('discord.js');
const { themedEmbed } = require('../../utils/theme');
const { COLORS } = require('../../config/blueprint');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Get a random meme from Reddit.'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const response = await fetch('https://meme-api.com/gimme');
      const data = await response.json();
      
      if (!data || !data.url) {
        throw new Error('Failed to fetch meme');
      }
      
      return interaction.editReply({
        embeds: [themedEmbed({
          title: data.title,
          color: COLORS.pink
        }).setImage(data.url).setFooter({ text: `👍 ${data.ups} | r/${data.subreddit}` })]
      });
    } catch (error) {
      return interaction.editReply({ content: 'Failed to fetch a meme. Try again later.' });
    }
  }
};
