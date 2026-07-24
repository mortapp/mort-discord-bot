const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { requireManageGuild } = require('../utils/guards');
const { FEATURE_CATEGORIES, stats, searchFeatures, listByCategory, setFeature, randomFeatures } = require('../services/featureService');

function featureLines(features) {
  if (!features.length) return 'No matching features found.';
  return features.map((feature) => `**${feature.id}** • ${feature.name}\n${feature.status.toUpperCase()} • ${feature.summary}`).join('\n\n').slice(0, 3900);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('features')
    .setDescription('Browse Mort Omega’s 1,200-module feature catalog.')
    .addSubcommand((sub) => sub.setName('stats').setDescription('Show Mort feature catalog stats.'))
    .addSubcommand((sub) => sub
      .setName('categories')
      .setDescription('Show Mort feature categories.'))
    .addSubcommand((sub) => sub
      .setName('search')
      .setDescription('Search Mort features.')
      .addStringOption((opt) => opt.setName('query').setDescription('Example: verify, ticket, cloud, raid, logs').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('list')
      .setDescription('List features in a category key or name.')
      .addStringOption((opt) => opt.setName('category').setDescription('Example: security, tickets, cloud').setRequired(true))
      .addIntegerOption((opt) => opt.setName('page').setDescription('Page number.').setMinValue(1).setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('enable')
      .setDescription('Enable a feature flag in Mort memory. Staff only.')
      .addStringOption((opt) => opt.setName('id').setDescription('Feature ID like sec-001').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('disable')
      .setDescription('Disable a feature flag in Mort memory. Staff only.')
      .addStringOption((opt) => opt.setName('id').setDescription('Feature ID like sec-001').setRequired(true)))
    .addSubcommand((sub) => sub.setName('random').setDescription('Show random Mort feature modules.')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'stats') {
      const result = stats(interaction.guild.id);
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({
        title: '🧬 Mort Omega Feature Catalog',
        description: [
          `Total modules: **${result.total}**`,
          `Categories: **${result.categories}**`,
          `Enabled feature flags in this server: **${result.enabled}**`,
          `Live: **${result.byStatus.live || 0}** • Ready: **${result.byStatus.ready || 0}** • Planned: **${result.byStatus.planned || 0}**`,
          '',
          'Mort does **not** register 1,200 slash commands because Discord servers would become unusable. The catalog keeps the features organized as modules/flags.'
        ].join('\n'),
        color: COLORS.royalPurple
      })] });
    }

    if (sub === 'categories') {
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({
        title: '🧭 Mort Feature Categories',
        description: FEATURE_CATEGORIES.map((cat) => `**${cat.key}** — ${cat.name}`).join('\n'),
        color: COLORS.lightBlue
      })] });
    }

    if (sub === 'search') {
      const query = interaction.options.getString('query', true);
      const results = searchFeatures(query, 10);
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: `🔎 Feature Search: ${query}`, description: featureLines(results), color: COLORS.lightBlue })] });
    }

    if (sub === 'list') {
      const category = interaction.options.getString('category', true);
      const page = interaction.options.getInteger('page') || 1;
      const result = listByCategory(category, page, 10);
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: `📚 ${category} Features`, description: `${featureLines(result.features)}\n\nPage **${result.page}/${result.totalPages}** • ${result.total} found`, color: COLORS.royalPurple })] });
    }

    if (sub === 'enable' || sub === 'disable') {
      requireManageGuild(interaction);
      const id = interaction.options.getString('id', true);
      const result = setFeature(interaction.guild.id, id, sub === 'enable');
      if (!result.ok) return interaction.reply({ ephemeral: true, content: `Feature ID not found: ${id}` });
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: sub === 'enable' ? '✅ Feature Enabled' : '🧯 Feature Disabled', description: `**${result.feature.id}** — ${result.feature.name}`, color: sub === 'enable' ? COLORS.success : COLORS.warning })] });
    }

    if (sub === 'random') {
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🎲 Random Mort Features', description: featureLines(randomFeatures(5)), color: COLORS.gold })] });
    }
  }
};
