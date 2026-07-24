const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');
const { requireModerator } = require('../utils/guards');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { getGuild, addWarning, getWarnings, removeWarning } = require('../services/dataStore');
const { sendLog } = require('../utils/logger');
const { applyEscalation } = require('../utils/escalation');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Mort moderation tools.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) => sub
      .setName('timeout')
      .setDescription('Timeout a member.')
      .addUserOption((opt) => opt.setName('user').setDescription('Member to timeout.').setRequired(true))
      .addIntegerOption((opt) => opt.setName('minutes').setDescription('Timeout length in minutes.').setMinValue(1).setMaxValue(10080).setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Reason.').setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('kick')
      .setDescription('Kick a member.')
      .addUserOption((opt) => opt.setName('user').setDescription('Member to kick.').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Reason.').setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('ban')
      .setDescription('Ban a member.')
      .addUserOption((opt) => opt.setName('user').setDescription('Member to ban.').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Reason.').setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('unban')
      .setDescription('Unban a user by ID.')
      .addStringOption((opt) => opt.setName('user_id').setDescription('User ID to unban.').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Reason.').setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('purge')
      .setDescription('Delete recent messages from this channel.')
      .addIntegerOption((opt) => opt.setName('amount').setDescription('Number of messages, max 100.').setMinValue(1).setMaxValue(100).setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('warn')
      .setDescription('Warn a member. Warnings escalate to timeout/kick/ban automatically.')
      .addUserOption((opt) => opt.setName('user').setDescription('Member to warn.').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Reason.').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('warnings')
      .setDescription("View a member's warning history.")
      .addUserOption((opt) => opt.setName('user').setDescription('Member to look up.').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('delwarn')
      .setDescription('Remove a specific warning by case number.')
      .addUserOption((opt) => opt.setName('user').setDescription('Member the warning belongs to.').setRequired(true))
      .addIntegerOption((opt) => opt.setName('case').setDescription('Case number to remove.').setMinValue(1).setRequired(true))),

  async execute(interaction) {
    requireModerator(interaction);
    const subcommand = interaction.options.getSubcommand();
    const memory = getGuild(interaction.guild.id);

    if (subcommand === 'timeout') {
      const user = interaction.options.getUser('user', true);
      const minutes = interaction.options.getInteger('minutes', true);
      const reason = interaction.options.getString('reason') || 'No reason provided.';
      const member = await interaction.guild.members.fetch(user.id);
      await member.timeout(minutes * 60 * 1000, reason);
      await sendLog(interaction.guild, memory, '⏳ Member Timed Out', `<@${user.id}> was timed out for ${minutes} minute(s).\nReason: ${reason}`, COLORS.warning);
      return interaction.reply({ embeds: [themedEmbed({ title: '⏳ Timeout Applied', description: `<@${user.id}> is timed out for **${minutes}** minute(s).`, color: COLORS.warning })] });
    }

    if (subcommand === 'kick') {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') || 'No reason provided.';
      const member = await interaction.guild.members.fetch(user.id);
      await member.kick(reason);
      await sendLog(interaction.guild, memory, '👢 Member Kicked', `<@${user.id}> was kicked.\nReason: ${reason}`, COLORS.warning);
      return interaction.reply({ embeds: [themedEmbed({ title: '👢 Member Kicked', description: `<@${user.id}> was kicked.`, color: COLORS.warning })] });
    }

    if (subcommand === 'ban') {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') || 'No reason provided.';
      await interaction.guild.members.ban(user.id, { reason });
      await sendLog(interaction.guild, memory, '🔨 Member Banned', `<@${user.id}> was banned.\nReason: ${reason}`, COLORS.danger);
      return interaction.reply({ embeds: [themedEmbed({ title: '🔨 Member Banned', description: `<@${user.id}> was banned.`, color: COLORS.danger })] });
    }

    if (subcommand === 'unban') {
      const userId = interaction.options.getString('user_id', true).trim();
      const reason = interaction.options.getString('reason') || 'No reason provided.';
      try {
        await interaction.guild.members.unban(userId, reason);
      } catch (error) {
        return interaction.reply({ ephemeral: true, content: `Couldn't unban that ID: ${error.message}` });
      }
      await sendLog(interaction.guild, memory, '🔓 Member Unbanned', `<@${userId}> (\`${userId}\`) was unbanned.\nReason: ${reason}`, COLORS.success);
      return interaction.reply({ embeds: [themedEmbed({ title: '🔓 Member Unbanned', description: `\`${userId}\` was unbanned.`, color: COLORS.success })] });
    }

    if (subcommand === 'purge') {
      const amount = interaction.options.getInteger('amount', true);
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await sendLog(interaction.guild, memory, '🧹 Messages Purged', `${deleted.size} messages were deleted in ${interaction.channel} by <@${interaction.user.id}>.`, COLORS.warning);
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🧹 Purge Complete', description: `Deleted **${deleted.size}** messages.`, color: COLORS.success })] });
    }

    if (subcommand === 'warn') {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason', true);
      const entry = addWarning(interaction.guild.id, user.id, { moderatorId: interaction.user.id, reason, source: 'manual' });
      const count = getWarnings(interaction.guild.id, user.id).length;

      await sendLog(interaction.guild, memory, '⚠️ Member Warned', `<@${user.id}> was warned by <@${interaction.user.id}> (case #${entry.case}).\nReason: ${reason}\nTotal warnings: ${count}`, COLORS.warning);

      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      const escalationResult = member ? await applyEscalation(interaction.guild, memory, member, count) : null;

      const description = [
        `<@${user.id}> was warned. (Case #${entry.case}, total: **${count}**)`,
        `Reason: ${reason}`,
        escalationResult ? `Auto-escalation: ${escalationResult}` : null
      ].filter(Boolean).join('\n');

      return interaction.reply({ embeds: [themedEmbed({ title: '⚠️ Warning Issued', description, color: COLORS.warning })] });
    }

    if (subcommand === 'warnings') {
      const user = interaction.options.getUser('user', true);
      const history = getWarnings(interaction.guild.id, user.id);
      if (!history.length) {
        return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '📋 Warning History', description: `<@${user.id}> has no warnings.`, color: COLORS.lightBlue })] });
      }
      const lines = history.slice(-10).reverse().map((entry) => `**#${entry.case}** — ${entry.reason} *(by <@${entry.moderatorId}>, ${new Date(entry.at).toLocaleDateString()})*`);
      return interaction.reply({
        ephemeral: true,
        embeds: [themedEmbed({
          title: `📋 Warning History (${history.length} total)`,
          description: lines.join('\n'),
          color: COLORS.royalPurple
        })]
      });
    }

    if (subcommand === 'delwarn') {
      const user = interaction.options.getUser('user', true);
      const caseId = interaction.options.getInteger('case', true);
      const removed = removeWarning(interaction.guild.id, user.id, caseId);
      if (!removed) {
        return interaction.reply({ ephemeral: true, content: `No warning with case #${caseId} found for <@${user.id}>.` });
      }
      await sendLog(interaction.guild, memory, '🗑️ Warning Removed', `Case #${caseId} for <@${user.id}> was removed by <@${interaction.user.id}>.`, COLORS.lightBlue);
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🗑️ Warning Removed', description: `Removed case #${caseId} for <@${user.id}>.`, color: COLORS.success })] });
    }

    return null;
  }
};
