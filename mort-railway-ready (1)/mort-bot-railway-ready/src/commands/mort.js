const { SlashCommandBuilder } = require('discord.js');
const { diagnose } = require('../services/setupService');
const { getInsights } = require('../services/dataStore');
const { themedEmbed } = require('../utils/theme');
const { COLORS, CHANNEL_BLUEPRINT, ROLE_BLUEPRINT } = require('../config/blueprint');
const { helpEmbed } = require('../services/panelService');
const { editMessageAnimation, introFrames } = require('../services/animationService');

function inviteUrl() {
  const clientId = process.env.CLIENT_ID || '1518021714494226695';
  return `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&integration_type=0&scope=bot+applications.commands`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mort')
    .setDescription('Mort status, help, diagnostics, intro, and invite tools.')
    .addSubcommand((sub) => sub.setName('help').setDescription('Show Mort command help.'))
    .addSubcommand((sub) => sub.setName('doctor').setDescription('Diagnose your Mort server setup.'))
    .addSubcommand((sub) => sub.setName('insights').setDescription('Show Mort error-learning insights.'))
    .addSubcommand((sub) => sub.setName('intro').setDescription('Send a Mort animated intro embed.'))
    .addSubcommand((sub) => sub.setName('invite').setDescription('Get Mort invite link.')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'help') {
      return interaction.reply({ ephemeral: true, embeds: [helpEmbed()] });
    }

    if (subcommand === 'doctor') {
      await interaction.deferReply({ ephemeral: true });
      const report = await diagnose(interaction.guild);
      const description = report.healthy
        ? 'Mort found the server blueprint healthy. No missing roles, categories, or channels.'
        : [
          'Mort found missing setup pieces:',
          `**Roles:** ${report.missing.roles.length ? report.missing.roles.join(', ') : 'none'}`,
          `**Categories:** ${report.missing.categories.length ? report.missing.categories.join(', ') : 'none'}`,
          `**Channels:** ${report.missing.channels.length ? report.missing.channels.join(', ') : 'none'}`,
          '',
          'Run `/setup repair` to rebuild them.'
        ].join('\n');

      return interaction.editReply({
        embeds: [themedEmbed({
          title: report.healthy ? '✅ Mort Doctor: Healthy' : '⚠️ Mort Doctor: Repair Recommended',
          description,
          color: report.healthy ? COLORS.success : COLORS.warning
        })]
      });
    }

    if (subcommand === 'insights') {
      const insights = getInsights(interaction.guild.id);
      const top = insights.topErrors.length
        ? insights.topErrors.map((entry) => `• **${entry.count}x** ${entry.message}`).join('\n')
        : 'No recorded errors for this server yet.';
      const repair = insights.repairHistory.length
        ? insights.repairHistory.map((entry) => `• ${new Date(entry.at).toLocaleString()} — ${entry.summary?.type || 'repair'}`).join('\n')
        : 'No repair history yet.';

      return interaction.reply({
        ephemeral: true,
        embeds: [themedEmbed({
          title: '🧬 Mort Learning Insights',
          description: [
            `Recorded errors: **${insights.totalErrors}**`,
            '',
            '**Top issues**',
            top,
            '',
            '**Repair history**',
            repair,
            '',
            'Mort uses this local memory to show patterns and guide `/setup repair`. This is practical error-learning, not real AI training.'
          ].join('\n'),
          color: COLORS.lightBlue
        })]
      });
    }

    if (subcommand === 'intro') {
      await interaction.reply({ embeds: [introFrames()[0]] });
      const message = await interaction.fetchReply();
      const frames = introFrames().map((embed) => ({ embeds: [embed] }));
      await editMessageAnimation(message, frames, 900);
      return null;
    }

    if (subcommand === 'invite') {
      return interaction.reply({
        ephemeral: true,
        embeds: [themedEmbed({
          title: '🔗 Mort Invite Link',
          description: [
            `[Invite Mort with setup permissions](${inviteUrl()})`,
            '',
            `Blueprint: **${ROLE_BLUEPRINT.length} roles**, **${CHANNEL_BLUEPRINT.length} categories**.`
          ].join('\n'),
          color: COLORS.royalPurple
        })]
      });
    }

    return null;
  }
};
