const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { requireGuildOwnerOrConfiguredOwner } = require('../utils/guards');
const { readState, getDataDirectory } = require('../services/dataStore');

function backupDirFor(guildId) {
  return path.join(getDataDirectory(), 'backups', guildId);
}

function ensureDir(guildId) {
  const directory = backupDirFor(guildId);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  return directory;
}

function backupFiles(guildId) {
  const directory = ensureDir(guildId);
  return fs.readdirSync(directory).filter((file) => file.endsWith('.json')).sort().reverse();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Create a private backup of this server’s Mort data.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) => sub.setName('create').setDescription('Create and download a private backup for this server only.'))
    .addSubcommand((sub) => sub.setName('list').setDescription('List this server’s recent Mort backups.'))
    .addSubcommand((sub) => sub.setName('prune').setDescription('Keep only the newest backups for this server.').addIntegerOption((opt) => opt.setName('keep').setDescription('How many backups to keep.').setMinValue(1).setMaxValue(20).setRequired(true))),

  async execute(interaction) {
    requireGuildOwnerOrConfiguredOwner(interaction);
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'create') {
      const directory = ensureDir(guildId);
      const state = readState();
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const name = `mort-backup-${guildId}-${stamp}.json`;
      const file = path.join(directory, name);
      const payload = {
        format: 'mort-guild-backup-v1',
        generatedAt: new Date().toISOString(),
        guildId,
        guild: state.guilds[guildId] || {}
      };
      fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      return interaction.reply({ ephemeral: true, content: '✅ Private server-scoped backup created. It contains only this server’s Mort data; keep the download confidential.', files: [new AttachmentBuilder(file, { name })] });
    }

    if (sub === 'list') {
      const files = backupFiles(guildId).slice(0, 10);
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🗄️ Private Server Backups', description: files.length ? files.map((file) => `• ${file}`).join('\n') : 'No backups yet. Run `/backup create`.', color: COLORS.lightBlue })] });
    }

    const keep = interaction.options.getInteger('keep', true);
    const directory = ensureDir(guildId);
    const files = backupFiles(guildId);
    const remove = files.slice(keep);
    for (const file of remove) fs.unlinkSync(path.join(directory, file));
    return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🧹 Backups Pruned', description: `Kept **${Math.min(keep, files.length)}** and removed **${remove.length}** old backups.`, color: COLORS.success })] });
  }
};
