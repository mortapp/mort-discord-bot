const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { openTicket, closeTicket, unclaimTicket, claimTicket } = require('../services/ticketService');
const { ticketPanel } = require('../services/panelService');
const { requireManageGuild } = require('../utils/guards');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { checkCooldown, formatRemaining } = require('../utils/cooldown');
const { getGuild } = require('../services/dataStore');

const TICKET_OPEN_COOLDOWN_MS = 60 * 1000;

async function ticketTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const ordered = [...messages.values()].reverse();
  const lines = ordered.map((msg) => {
    const content = msg.content || (msg.embeds.length ? '[embed]' : msg.attachments.size ? '[attachment]' : '');
    return `[${msg.createdAt.toISOString()}] ${msg.author?.tag || 'Unknown'}: ${content}`;
  });
  return `Mort transcript for #${channel.name}\nGenerated ${new Date().toISOString()}\n\n${lines.join('\n')}`;
}

function isTicket(interaction) {
  const memory = getGuild(interaction.guild.id);
  return memory.tickets?.[interaction.channel.id] || null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Mort support tickets.')
    .addSubcommand((sub) => sub
      .setName('open')
      .setDescription('Open a private support ticket.')
      .addStringOption((opt) => opt.setName('reason').setDescription('Why are you opening this ticket?').setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('close')
      .setDescription('Close the current ticket.')
      .addStringOption((opt) => opt.setName('reason').setDescription('Why is this ticket being closed?').setRequired(false)))
    .addSubcommand((sub) => sub.setName('claim').setDescription('Claim the current ticket.'))
    .addSubcommand((sub) => sub.setName('unclaim').setDescription('Release your claim on the current ticket.'))
    .addSubcommand((sub) => sub
      .setName('rename')
      .setDescription('Rename the current ticket channel.')
      .addStringOption((opt) => opt.setName('name').setDescription('New ticket name.').setMinLength(2).setMaxLength(80).setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('add-user')
      .setDescription('Add a member to this ticket.')
      .addUserOption((opt) => opt.setName('user').setDescription('Member to add.').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('remove-user')
      .setDescription('Remove a member from this ticket.')
      .addUserOption((opt) => opt.setName('user').setDescription('Member to remove.').setRequired(true)))
    .addSubcommand((sub) => sub.setName('transcript').setDescription('Generate a transcript attachment for this ticket.'))
    .addSubcommand((sub) => sub.setName('panel').setDescription('Send the ticket panel in this channel. Staff only.'))
    .addSubcommand((sub) => sub.setName('setup').setDescription('Send the ticket panel and show ticket setup status. Staff only.')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'open') {
      const cooldown = checkCooldown('ticket-open', interaction.user.id, TICKET_OPEN_COOLDOWN_MS);
      if (cooldown.onCooldown) {
        return interaction.reply({ ephemeral: true, content: `Slow down — you can open another ticket in **${formatRemaining(cooldown.remainingMs)}**.` });
      }
      const reason = interaction.options.getString('reason') || 'No reason provided.';
      return openTicket(interaction, reason);
    }

    if (subcommand === 'close') {
      const reason = interaction.options.getString('reason') || 'No reason provided.';
      return closeTicket(interaction, reason);
    }

    if (subcommand === 'claim') return claimTicket(interaction);
    if (subcommand === 'unclaim') return unclaimTicket(interaction);

    if (['rename', 'add-user', 'remove-user', 'transcript'].includes(subcommand)) {
      const ticket = isTicket(interaction);
      if (!ticket) return interaction.reply({ ephemeral: true, content: 'This is not a Mort ticket channel.' });
      const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
      if (!isStaff) return interaction.reply({ ephemeral: true, content: 'Only staff can manage ticket users, names, and transcripts.' });
    }

    if (subcommand === 'rename') {
      const name = interaction.options.getString('name', true).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 80);
      await interaction.channel.setName(name.startsWith('ticket-') ? name : `ticket-${name}`, 'Mort ticket rename');
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '✅ Ticket Renamed', description: `Ticket renamed to **${interaction.channel.name}**.`, color: COLORS.success })] });
    }

    if (subcommand === 'add-user') {
      const user = interaction.options.getUser('user', true);
      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true }, { reason: 'Mort ticket add-user' });
      return interaction.reply({ embeds: [themedEmbed({ title: '➕ User Added', description: `<@${user.id}> can now see this ticket.`, color: COLORS.success })] });
    }

    if (subcommand === 'remove-user') {
      const user = interaction.options.getUser('user', true);
      await interaction.channel.permissionOverwrites.delete(user.id, 'Mort ticket remove-user').catch(async () => {
        await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: false }, { reason: 'Mort ticket remove-user' });
      });
      return interaction.reply({ embeds: [themedEmbed({ title: '➖ User Removed', description: `<@${user.id}> was removed from this ticket.`, color: COLORS.warning })] });
    }

    if (subcommand === 'transcript') {
      const transcript = await ticketTranscript(interaction.channel);
      const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: `transcript-${interaction.channel.name}.txt` });
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🧾 Ticket Transcript', description: 'Transcript generated.', color: COLORS.lightBlue })], files: [attachment] });
    }

    if (subcommand === 'panel' || subcommand === 'setup') {
      requireManageGuild(interaction);
      await interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🎫 Ticket Panel Sent', description: subcommand === 'setup' ? 'Ticket setup is ready. The panel has been posted in this channel.' : 'Mort ticket panel deployed.', color: COLORS.lightBlue })] });
      return interaction.channel.send(ticketPanel());
    }

    return null;
  }
};
