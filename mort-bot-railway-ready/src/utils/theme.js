const { EmbedBuilder } = require('discord.js');
const { THEME, COLORS } = require('../config/blueprint');

function themedEmbed({ title, description, color = COLORS.royalPurple, fields = [], footer = true }) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(description || null)
    .setTimestamp();

  if (fields.length) embed.addFields(fields);
  if (footer) embed.setFooter({ text: THEME.footer });
  return embed;
}

function progressBar(step, total, length = 12) {
  const filled = Math.max(0, Math.min(length, Math.round((step / total) * length)));
  return '▰'.repeat(filled) + '▱'.repeat(length - filled);
}

function listLines(items) {
  return items.map((item) => `• ${item}`).join('\n');
}

module.exports = {
  themedEmbed,
  progressBar,
  listLines
};
