const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { requireManageGuild } = require('../utils/guards');
const { antiRaidStatus, setAntiRaid, applyChannelLockdown } = require('../services/raidService');
const { getGuild } = require('../services/dataStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('raid')
    .setDescription('Mort anti-raid and panic controls.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('status').setDescription('Show anti-raid status.'))
    .addSubcommand((sub) => sub
      .setName('config')
      .setDescription('Set anti-raid join burst detection.')
      .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable anti-raid?').setRequired(true))
      .addIntegerOption((opt) => opt.setName('threshold').setDescription('Joins allowed in the window.').setMinValue(2).setMaxValue(100).setRequired(true))
      .addIntegerOption((opt) => opt.setName('window').setDescription('Window in seconds.').setMinValue(10).setMaxValue(600).setRequired(true)))
    .addSubcommand((sub) => sub.setName('panic').setDescription('Emergency: stop members from sending/speaking until unlocked.'))
    .addSubcommand((sub) => sub.setName('unlock').setDescription('Release Mort panic lockdown.')),

  async execute(interaction) {
    requireManageGuild(interaction);
    const sub = interaction.options.getSubcommand();

    if (sub === 'status') {
      const status = antiRaidStatus(interaction.guild.id);
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🚨 Anti-Raid Status', description: [
        `Enabled: **${status.enabled ? 'ON' : 'OFF'}**`,
        `Panic: **${status.panic ? 'ON' : 'OFF'}**`,
        `Threshold: **${status.threshold} joins / ${status.windowSeconds}s**`,
        `Current window joins: **${status.currentWindowJoins}**`,
        `Last triggered: **${status.lastTriggeredAt || 'never'}**`
      ].join('\n'), color: status.panic ? COLORS.danger : COLORS.lightBlue })] });
    }

    if (sub === 'config') {
      const enabled = interaction.options.getBoolean('enabled', true);
      const threshold = interaction.options.getInteger('threshold', true);
      const windowSeconds = interaction.options.getInteger('window', true);
      setAntiRaid(interaction.guild.id, { enabled, threshold, windowSeconds });
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '✅ Anti-Raid Config Updated', description: `Enabled: **${enabled}**\nThreshold: **${threshold} joins / ${windowSeconds}s**`, color: COLORS.success })] });
    }

    if (sub === 'panic') {
      const memory = setAntiRaid(interaction.guild.id, { panic: true });
      await interaction.deferReply({ ephemeral: true });
      await applyChannelLockdown(interaction.guild, memory, true);
      return interaction.editReply({ embeds: [themedEmbed({ title: '🚨 Panic Lockdown Enabled', description: 'Mort locked member sending/speaking permissions across channels. Run `/raid unlock` when safe.', color: COLORS.danger })] });
    }

    if (sub === 'unlock') {
      const memory = setAntiRaid(interaction.guild.id, { panic: false });
      await interaction.deferReply({ ephemeral: true });
      await applyChannelLockdown(interaction.guild, memory, false);
      return interaction.editReply({ embeds: [themedEmbed({ title: '✅ Panic Lockdown Released', description: 'Mort restored member send/speak permissions. Run `/security refresh-perms` if anything looks off.', color: COLORS.success })] });
    }
  }
};
