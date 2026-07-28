const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');
const { setupServer, diagnose, previewText } = require('../services/setupService');
const { animatedReply } = require('../services/animationService');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { requireManageGuild } = require('../utils/guards');
const { diagnosePermissions, permissionReportEmbed } = require('../services/permissionService');

async function runRepair(interaction, label = 'Mort Repair') {
  const before = await diagnose(interaction.guild);
  await animatedReply(
    interaction,
    label,
    ['Scanning setup memory...', 'Checking roles...', 'Checking categories...', 'Checking channels...', 'Checking permissions...', 'Repairing missing pieces...'],
    before.healthy
      ? 'Mort found no missing setup pieces. Your server blueprint is healthy.'
      : 'Mort found missing pieces and rebuilt the server blueprint.'
  );

  if (!before.healthy) await setupServer(interaction.guild);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Mort server setup and repair system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('preview')
      .setDescription('Preview Mort roles, categories, and channels.'))
    .addSubcommand((sub) => sub
      .setName('server')
      .setDescription('Create the full Mort server setup.'))
    .addSubcommand((sub) => sub
      .setName('repair')
      .setDescription('Recreate missing Mort roles/channels/categories without wiping anything.'))
    .addSubcommand((sub) => sub
      .setName('fix')
      .setDescription('One-tap repair for roles, channels, verify setup, and stored Mort memory.'))
    .addSubcommand((sub) => sub
      .setName('permissions')
      .setDescription('Check Mort role and permission status.')),

  async execute(interaction) {
    requireManageGuild(interaction);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'preview') {
      return interaction.reply({
        ephemeral: true,
        embeds: [themedEmbed({
          title: '✦ Mort Setup Preview',
          description: previewText().slice(0, 3900),
          color: COLORS.royalPurple
        })]
      });
    }

    if (subcommand === 'server') {
      await interaction.deferReply({ ephemeral: true });
      const result = await setupServer(interaction.guild);
      const permissionReport = await diagnosePermissions(interaction.guild);
      const createdSummary = [
        `Roles created: **${result.created.roles.length}**`,
        `Categories created: **${result.created.categories.length}**`,
        `Channels created: **${result.created.channels.length}**`,
        '',
        'Mort setup is live. Check the welcome, verify, tickets, and server-map channels.',
        '',
        permissionReport.healthy ? '✅ Permission check passed.' : '⚠️ Run `/mort doctor` to fix role/permission issues.'
      ].join('\n');

      return interaction.editReply({
        embeds: [themedEmbed({
          title: '✅ Mort Server Setup Complete',
          description: createdSummary,
          color: COLORS.success
        })]
      });
    }

    if (subcommand === 'repair' || subcommand === 'fix') {
      await runRepair(interaction, subcommand === 'fix' ? 'Mort Emergency Fix' : 'Mort Repair');
      return null;
    }

    if (subcommand === 'permissions') {
      const report = await diagnosePermissions(interaction.guild);
      return interaction.reply({ ephemeral: true, embeds: [permissionReportEmbed(report)] });
    }

    return null;
  }
};
