const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { requireManageGuild } = require('../utils/guards');
const { readState, writeState } = require('../services/dataStore');

const backupDir = path.resolve(process.cwd(), 'data', 'backups');
function ensureDir() { fs.mkdirSync(backupDir, { recursive: true }); }
function backupFiles() {
  ensureDir();
  return fs.readdirSync(backupDir).filter((file) => file.endsWith('.json')).sort().reverse();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Backup Mort memory and server configuration.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('create').setDescription('Create and download a Mort memory backup.'))
    .addSubcommand((sub) => sub.setName('list').setDescription('List recent backups.'))
    .addSubcommand((sub) => sub
      .setName('prune')
      .setDescription('Keep only the newest backups.')
      .addIntegerOption((opt) => opt.setName('keep').setDescription('How many backups to keep.').setMinValue(1).setMaxValue(20).setRequired(true))),

  async execute(interaction) {
    requireManageGuild(interaction);
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      ensureDir();
      const state = readState();
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const name = `mort-backup-${interaction.guild.id}-${stamp}.json`;
      const file = path.join(backupDir, name);
      fs.writeFileSync(file, JSON.stringify(state, null, 2));
      const attachment = new AttachmentBuilder(file, { name });
      return interaction.reply({ ephemeral: true, content: '✅ Mort backup created. Keep this private.', files: [attachment] });
    }

    if (sub === 'list') {
      const files = backupFiles().slice(0, 10);
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🗄️ Mort Backups', description: files.length ? files.map((file) => `• ${file}`).join('\n') : 'No backups yet. Run `/backup create`.', color: COLORS.lightBlue })] });
    }

    if (sub === 'prune') {
      const keep = interaction.options.getInteger('keep', true);
      const files = backupFiles();
      const remove = files.slice(keep);
      for (const file of remove) fs.unlinkSync(path.join(backupDir, file));
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🧹 Backups Pruned', description: `Kept **${Math.min(keep, files.length)}** and removed **${remove.length}** old backups.`, color: COLORS.success })] });
    }
  }
};
