const { SlashCommandBuilder, version: djsVersion } = require('discord.js');
const { diagnose, setupServer } = require('../services/setupService');
const { getInsights, readState } = require('../services/dataStore');
const { themedEmbed } = require('../utils/theme');
const { COLORS, CHANNEL_BLUEPRINT, ROLE_BLUEPRINT } = require('../config/blueprint');
const { helpEmbed } = require('../services/panelService');
const { editMessageAnimation, introFrames } = require('../services/animationService');
const { diagnosePermissions, permissionReportEmbed, permissionFixText } = require('../services/permissionService');
const { antiRaidStatus } = require('../services/raidService');
const { antiNukeStatus } = require('../services/antinukeService');
const { assistantConfig } = require('../services/assistantService');
const { requireManageGuild } = require('../utils/guards');

function inviteUrl(client) {
  // Prefer the running client's own application ID (always correct for
  // *this* bot) over env/config, and never fall back to a hardcoded ID --
  // a stale fallback here would silently generate an invite link for a
  // different Discord application entirely.
  const clientId = client?.application?.id || client?.user?.id || process.env.CLIENT_ID;
  if (!clientId) return 'Invite link unavailable: Mort could not determine its own Application ID yet. Try again in a moment, or set CLIENT_ID.';
  return `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&integration_type=0&scope=bot+applications.commands`;
}

function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [days ? `${days}d` : null, hours ? `${hours}h` : null, minutes ? `${minutes}m` : null, `${seconds}s`].filter(Boolean).join(' ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mort')
    .setDescription('Mort status, help, diagnostics, dashboard, intro, and invite tools.')
    .addSubcommand((sub) => sub.setName('help').setDescription('Show Mort command help.'))
    .addSubcommand((sub) => sub.setName('doctor').setDescription('Diagnose your Mort server setup and permissions.'))
    .addSubcommand((sub) => sub.setName('dashboard').setDescription('Show the full Mort server dashboard.'))
    .addSubcommand((sub) => sub.setName('permissions').setDescription('Show the exact permissions and role hierarchy Mort needs.'))
    .addSubcommand((sub) => sub.setName('emergency-fix').setDescription('Owner/admin repair for roles, channels, verify setup, and permissions.'))
    .addSubcommand((sub) => sub.setName('stats').setDescription('Show Mort runtime and memory stats.'))
    .addSubcommand((sub) => sub.setName('uptime').setDescription('Show Mort uptime.'))
    .addSubcommand((sub) => sub.setName('about').setDescription('Show Mort version and systems.'))
    .addSubcommand((sub) => sub.setName('insights').setDescription('Show Mort error-learning insights.'))
    .addSubcommand((sub) => sub.setName('intro').setDescription('Send a Mort animated intro embed.'))
    .addSubcommand((sub) => sub.setName('invite').setDescription('Get Mort invite link.')),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'help') {
      return interaction.reply({ ephemeral: true, embeds: [helpEmbed()] });
    }

    if (subcommand === 'doctor') {
      await interaction.deferReply({ ephemeral: true });
      const [setupReport, permissionReport] = await Promise.all([
        diagnose(interaction.guild),
        diagnosePermissions(interaction.guild)
      ]);
      const setupDescription = setupReport.healthy
        ? '✅ Server blueprint is healthy. No missing roles, categories, or channels.'
        : [
          '⚠️ Mort found missing setup pieces:',
          `**Roles:** ${setupReport.missing.roles.length ? setupReport.missing.roles.join(', ') : 'none'}`,
          `**Categories:** ${setupReport.missing.categories.length ? setupReport.missing.categories.join(', ') : 'none'}`,
          `**Channels:** ${setupReport.missing.channels.length ? setupReport.missing.channels.join(', ') : 'none'}`,
          '',
          'Run `/setup fix` or `/mort emergency-fix` to rebuild them.'
        ].join('\n');

      return interaction.editReply({
        embeds: [themedEmbed({
          title: setupReport.healthy && permissionReport.healthy ? '✅ Mort Doctor: Healthy' : '⚠️ Mort Doctor: Fix Recommended',
          description: [setupDescription, '', '**Permissions**', permissionFixText(permissionReport)].join('\n'),
          color: setupReport.healthy && permissionReport.healthy ? COLORS.success : COLORS.warning
        })]
      });
    }

    if (subcommand === 'permissions') {
      const report = await diagnosePermissions(interaction.guild);
      return interaction.reply({ ephemeral: true, embeds: [permissionReportEmbed(report)] });
    }

    if (subcommand === 'emergency-fix') {
      requireManageGuild(interaction);
      await interaction.deferReply({ ephemeral: true });
      const result = await setupServer(interaction.guild);
      const permissionReport = await diagnosePermissions(interaction.guild);
      return interaction.editReply({ embeds: [themedEmbed({
        title: '🧬 Mort Emergency Fix Complete',
        description: [
          `Roles created/repaired: **${result.created.roles.length}**`,
          `Categories created/repaired: **${result.created.categories.length}**`,
          `Channels created/repaired: **${result.created.channels.length}**`,
          '',
          permissionFixText(permissionReport),
          '',
          'Next: run `/verify panel` and test Verify Me from an alt account.'
        ].join('\n'),
        color: permissionReport.healthy ? COLORS.success : COLORS.warning
      })] });
    }

    if (subcommand === 'dashboard') {
      await interaction.deferReply({ ephemeral: true });
      const [setupReport, permissionReport] = await Promise.all([
        diagnose(interaction.guild),
        diagnosePermissions(interaction.guild)
      ]);
      const raid = antiRaidStatus(interaction.guild.id);
      const nuke = antiNukeStatus(interaction.guild.id);
      const assistant = assistantConfig(interaction.guild.id);
      const state = readState();
      const memory = state.guilds?.[interaction.guild.id] || {};
      const memberCount = interaction.guild.memberCount || interaction.guild.members.cache.size;

      return interaction.editReply({ embeds: [themedEmbed({
        title: '📊 Mort Dashboard',
        description: [
          `Bot: **${client?.user?.tag || interaction.client.user.tag}**`,
          `Version: **${process.env.npm_package_version || '3.4.0'}**`,
          `Uptime: **${formatDuration(interaction.client.uptime || 0)}**`,
          `Server members: **${memberCount}**`,
          `Commands loaded: **${interaction.client.commands?.size || 'unknown'}**`,
          '',
          `Setup: **${setupReport.healthy ? 'Healthy' : 'Needs repair'}**`,
          `Permissions: **${permissionReport.healthy ? 'Healthy' : 'Needs fix'}**`,
          `Verify role/channel: **${memory.roles?.verified && memory.channels?.verify ? 'Ready' : 'Check /verify status'}**`,
          `Tickets: **${Object.keys(memory.tickets || {}).length} open**`,
          `XP users: **${Object.keys(memory.xp || {}).length}**`,
          `Economy users: **${Object.keys(memory.economy || {}).length}**`,
          `Assistant: **${assistant.enabled ? 'ON' : 'OFF'}**`,
          `Anti-raid: **${raid.enabled ? 'ON' : 'OFF'}**${raid.panic ? ' • PANIC' : ''}`,
          `Anti-nuke: **${nuke.enabled ? 'ON' : 'OFF'}**`,
          '',
          permissionReport.healthy ? '✅ Mort role hierarchy is okay.' : '⚠️ Run `/mort permissions` for exact role fixes.'
        ].join('\n'),
        color: setupReport.healthy && permissionReport.healthy ? COLORS.success : COLORS.royalPurple
      })] });
    }

    if (subcommand === 'stats') {
      const state = readState();
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({
        title: '📈 Mort Runtime Stats',
        description: [
          `Guilds in memory: **${Object.keys(state.guilds || {}).length}**`,
          `Logged errors: **${state.errors?.length || 0}**`,
          `Repair history: **${state.repairHistory?.length || 0}**`,
          `Discord.js: **${djsVersion}**`,
          `Node: **${process.version}**`,
          `Uptime: **${formatDuration(interaction.client.uptime || 0)}**`
        ].join('\n'),
        color: COLORS.lightBlue
      })] });
    }

    if (subcommand === 'uptime') {
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '⏱️ Mort Uptime', description: `Mort has been running for **${formatDuration(interaction.client.uptime || 0)}**.`, color: COLORS.success })] });
    }

    if (subcommand === 'about') {
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({
        title: '🤖 About Mort v3.5.0',
        description: [
          'Mort is a Railway-ready Discord.js v14 server bot for setup, verification, moderation, tickets, XP, economy, security, logs, backups, and @mention help.',
          '',
          'Theme: **black / purple / light blue / white**',
          `Invite: ${inviteUrl(interaction.client)}`
        ].join('\n'),
        color: COLORS.royalPurple
      })] });
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
            'Mort uses local memory to show patterns and guide repairs. This is practical error-learning, not paid AI training.'
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
            `[Invite Mort with setup permissions](${inviteUrl(interaction.client)})`,
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
