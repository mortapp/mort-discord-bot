const { SlashCommandBuilder } = require('discord.js');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { createReminder, listReminders, cancelReminder } = require('../services/reminderService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set, list, or cancel persistent Mort reminders.')
    .addSubcommand((sub) => sub.setName('set').setDescription('Set a reminder that survives bot restarts.').addIntegerOption((opt) => opt.setName('minutes').setDescription('Minutes from now (up to 7 days).').setMinValue(1).setMaxValue(10080).setRequired(true)).addStringOption((opt) => opt.setName('text').setDescription('Reminder text.').setMaxLength(500).setRequired(true)))
    .addSubcommand((sub) => sub.setName('list').setDescription('List your pending reminders.'))
    .addSubcommand((sub) => sub.setName('cancel').setDescription('Cancel one of your reminders.').addStringOption((opt) => opt.setName('id').setDescription('Reminder ID from /remind list.').setRequired(true))),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'set') {
      const minutes = interaction.options.getInteger('minutes', true);
      const text = interaction.options.getString('text', true);
      const reminder = createReminder(client, interaction, minutes, text);
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '⏰ Persistent Reminder Set', description: `I will remind you <t:${Math.floor(new Date(reminder.dueAt).getTime() / 1000)}:R>.\n\n**ID:** \`${reminder.id}\`\n${reminder.text}`, color: COLORS.success })] });
    }

    if (subcommand === 'list') {
      const reminders = listReminders(interaction.guild.id, interaction.user.id);
      const description = reminders.length
        ? reminders.slice(0, 15).map((reminder) => `• \`${reminder.id}\` — <t:${Math.floor(new Date(reminder.dueAt).getTime() / 1000)}:R>\n  ${reminder.text}`).join('\n')
        : 'You have no pending reminders.';
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '⏰ Your Mort Reminders', description, color: COLORS.lightBlue })] });
    }

    const id = interaction.options.getString('id', true).trim();
    const removed = cancelReminder(client, interaction.guild.id, interaction.user.id, id);
    return interaction.reply({ ephemeral: true, content: removed ? `✅ Reminder \`${id}\` cancelled.` : 'No matching reminder was found. Run `/remind list` to view your reminder IDs.' });
  }
};
