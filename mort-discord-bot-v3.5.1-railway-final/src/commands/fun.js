const { SlashCommandBuilder } = require('discord.js');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fun')
    .setDescription('Mort fun commands.')
    .addSubcommand((sub) => sub
      .setName('8ball')
      .setDescription('Ask Mort 8ball a question.')
      .addStringOption((opt) => opt.setName('question').setDescription('Your question.').setMaxLength(250).setRequired(true)))
    .addSubcommand((sub) => sub.setName('coinflip').setDescription('Flip a coin.'))
    .addSubcommand((sub) => sub
      .setName('dice')
      .setDescription('Roll dice.')
      .addIntegerOption((opt) => opt.setName('sides').setDescription('Dice sides.').setMinValue(2).setMaxValue(1000).setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('choose')
      .setDescription('Let Mort choose between options split by commas.')
      .addStringOption((opt) => opt.setName('options').setDescription('Example: pizza, burgers, tacos').setMaxLength(500).setRequired(true)))
    .addSubcommand((sub) => sub.setName('quote').setDescription('Get a Mort quote.')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === '8ball') {
      const question = interaction.options.getString('question', true);
      const answers = ['Yes.', 'No.', 'Maybe.', 'Ask again after setup.', 'Mort says lock in.', 'Probably.', 'Not looking good.', 'Absolutely.'];
      return interaction.reply({ embeds: [themedEmbed({ title: '🎱 Mort 8ball', description: `**Question:** ${question}\n**Answer:** ${pick(answers)}`, color: COLORS.royalPurple })] });
    }

    if (sub === 'coinflip') {
      return interaction.reply({ embeds: [themedEmbed({ title: '🪙 Coin Flip', description: `Mort flipped **${Math.random() < 0.5 ? 'Heads' : 'Tails'}**.`, color: COLORS.gold })] });
    }

    if (sub === 'dice') {
      const sides = interaction.options.getInteger('sides') || 6;
      const roll = Math.floor(Math.random() * sides) + 1;
      return interaction.reply({ embeds: [themedEmbed({ title: '🎲 Dice Roll', description: `d${sides}: **${roll}**`, color: COLORS.lightBlue })] });
    }

    if (sub === 'choose') {
      const raw = interaction.options.getString('options', true);
      const options = raw.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20);
      if (options.length < 2) return interaction.reply({ ephemeral: true, content: 'Give me at least two comma-separated options.' });
      return interaction.reply({ embeds: [themedEmbed({ title: '🧠 Mort Chooses', description: `I pick: **${pick(options)}**`, color: COLORS.success })] });
    }

    if (sub === 'quote') {
      return interaction.reply({ embeds: [themedEmbed({ title: '💬 Mort Quote', description: pick([
        'Stable servers win.',
        'Move Mort’s role up, then problems go down.',
        'Verify first. Talk after.',
        'Clean logs save headaches.',
        'Ship it, test it, fix it.'
      ]), color: COLORS.whiteGlow })] });
    }
  }
};
