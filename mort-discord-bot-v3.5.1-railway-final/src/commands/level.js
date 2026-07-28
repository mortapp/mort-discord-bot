const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuild, updateGuild } = require('../services/dataStore');
const { getRank, getLeaderboard } = require('../services/engagementService');
const { themedEmbed, progressBar } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { requireManageGuild } = require('../utils/guards');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Mort XP, rank, and leaderboard system.')
    .addSubcommand((sub) => sub
      .setName('rank')
      .setDescription('Show your rank or another member rank.')
      .addUserOption((opt) => opt.setName('user').setDescription('Member to check.').setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('leaderboard')
      .setDescription('Show the top Mort members.'))
    .addSubcommand((sub) => sub
      .setName('toggle')
      .setDescription('Turn XP on/off.')
      .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable XP?').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('announcements')
      .setDescription('Turn level-up announcements on/off.')
      .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable level-up messages?').setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'rank') {
      const user = interaction.options.getUser('user') || interaction.user;
      const rank = getRank(interaction.guild.id, user.id);
      const percent = rank.nextLevelXp ? Math.min(rank.xp / rank.nextLevelXp, 1) : 0;
      return interaction.reply({
        embeds: [themedEmbed({
          title: `✦ ${user.username}'s Mort Rank`,
          description: [
            `Rank: **${rank.rank ? `#${rank.rank}` : 'Unranked'}**`,
            `Level: **${rank.level || 0}**`,
            `XP: **${rank.xp || 0}/${rank.nextLevelXp}**`,
            `Messages counted: **${rank.messages || 0}**`,
            progressBar(Math.round(percent * 10), 10, 14)
          ].join('\n'),
          color: COLORS.lightBlue
        })]
      });
    }

    if (subcommand === 'leaderboard') {
      const rows = getLeaderboard(interaction.guild.id, 10);
      const description = rows.length
        ? rows.map((row) => `**#${row.rank}** <@${row.userId}> — Level **${row.level || 0}**, XP **${row.xp || 0}**`).join('\n')
        : 'No XP yet. Chat after verification to start gaining XP.';
      return interaction.reply({ embeds: [themedEmbed({ title: '🏆 Mort Leaderboard', description, color: COLORS.royalPurple })] });
    }

    requireManageGuild(interaction);

    if (subcommand === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled', true);
      updateGuild(interaction.guild.id, (guild) => { guild.config.xpEnabled = enabled; });
      return interaction.reply({ ephemeral: true, content: `✅ Mort XP is now **${enabled ? 'ON' : 'OFF'}**.` });
    }

    if (subcommand === 'announcements') {
      const enabled = interaction.options.getBoolean('enabled', true);
      updateGuild(interaction.guild.id, (guild) => { guild.config.levelAnnouncements = enabled; });
      return interaction.reply({ ephemeral: true, content: `✅ Level-up announcements are now **${enabled ? 'ON' : 'OFF'}**.` });
    }

    return null;
  }
};
