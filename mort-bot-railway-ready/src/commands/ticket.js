const { SlashCommandBuilder } = require('discord.js');
const { openTicket, closeTicket, unclaimTicket } = require('../services/ticketService');
const { ticketPanel } = require('../services/panelService');
const { requireManageGuild } = require('../utils/guards');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { checkCooldown, formatRemaining } = require('../utils/cooldown');

const TICKET_OPEN_COOLDOWN_MS = 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Mort support tickets.')
    .addSubcommand((sub) => sub
      .setName('open')
      .setDescription('Open a private support ticket.')
      .addStringOption((opt) => opt
        .setName('reason')
        .setDescription('Why are you opening this ticket?')
        .setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('close')
      .setDescription('Close the current ticket.')
      .addStringOption((opt) => opt
        .setName('reason')
        .setDescription('Why is this ticket being closed?')
        .setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('unclaim')
      .setDescription('Release your claim on the current ticket.'))
    .addSubcommand((sub) => sub
      .setName('panel')
      .setDescription('Send the ticket panel in this channel. Staff only.')),

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

    if (subcommand === 'unclaim') {
      return unclaimTicket(interaction);
    }

    if (subcommand === 'panel') {
      requireManageGuild(interaction);
      await interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🎫 Ticket Panel Sent', description: 'Mort ticket panel deployed.', color: COLORS.lightBlue })] });
      return interaction.channel.send(ticketPanel());
    }

    return null;
  }
};
