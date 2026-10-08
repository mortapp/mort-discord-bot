const { ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { getGuild, addTicket, removeTicket, updateGuild } = require('./dataStore');
const { ticketControls } = require('./panelService');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { sendLog, getLogChannel } = require('../utils/logger');
const { checkCooldown, clearCooldown, formatRemaining } = require('../utils/cooldown');

const TICKET_OPEN_COOLDOWN_MS = 60 * 1000;
const openingTickets = new Set();

function safeTicketName(username) {
  return username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 18) || 'member';
}

function cleanTicketReason(reason) {
  return String(reason || 'No reason provided.').replace(/[\r\n]+/g, ' ').trim().slice(0, 450) || 'No reason provided.';
}

function isTicketStaff(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)
    || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function ticketOverwrites(guild, member, memory) {
  const staffRoleIds = [memory.roles?.owner, memory.roles?.admin, memory.roles?.moderator, memory.roles?.helper].filter(Boolean);
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
    ...staffRoleIds.map((id) => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] }))
  ];
}

async function openTicket(interaction, reason = 'No reason provided.') {
  const key = `${interaction.guild.id}:${interaction.user.id}`;
  if (openingTickets.has(key)) {
    return interaction.reply({ ephemeral: true, content: 'Your ticket request is already being processed. Please wait a moment.' });
  }

  const cooldown = checkCooldown(`ticket-open:${interaction.guild.id}`, interaction.user.id, TICKET_OPEN_COOLDOWN_MS);
  if (cooldown.onCooldown) {
    return interaction.reply({ ephemeral: true, content: `Slow down — you can open another ticket in **${formatRemaining(cooldown.remainingMs)}**.` });
  }

  openingTickets.add(key);
  let created = false;
  try {
    await interaction.deferReply({ ephemeral: true });
    const memory = getGuild(interaction.guild.id);
    const ticketCategoryId = memory.config?.ticketCategoryId || memory.categories?.support;
    const category = ticketCategoryId ? await interaction.guild.channels.fetch(ticketCategoryId).catch(() => null) : null;
    const openExisting = Object.entries(memory.tickets || {}).find(([, ticket]) => ticket.ownerId === interaction.user.id && ticket.status === 'open');

    if (openExisting) {
      const [existingChannelId] = openExisting;
      const stillExists = await interaction.guild.channels.fetch(existingChannelId).catch(() => null);
      if (stillExists) {
        return interaction.editReply({ embeds: [themedEmbed({ title: '🎫 Ticket Already Open', description: `You already have a ticket: <#${existingChannelId}>`, color: COLORS.warning })] });
      }
      removeTicket(interaction.guild.id, existingChannelId);
    }

    const cleanedReason = cleanTicketReason(reason);
    const channel = await interaction.guild.channels.create({
      name: `ticket-${safeTicketName(interaction.user.username)}`,
      type: ChannelType.GuildText,
      parent: category?.id,
      topic: `Mort ticket for ${interaction.user.tag} • ${cleanedReason}`.slice(0, 1024),
      permissionOverwrites: ticketOverwrites(interaction.guild, interaction.member, memory),
      reason: `Mort ticket opened by ${interaction.user.tag}`
    });

    addTicket(interaction.guild.id, channel.id, {
      ownerId: interaction.user.id,
      ownerTag: interaction.user.tag,
      reason: cleanedReason,
      status: 'open',
      openedAt: new Date().toISOString()
    });

    await channel.send({
      content: `<@${interaction.user.id}>`,
      allowedMentions: { users: [interaction.user.id] },
      embeds: [themedEmbed({ title: '🎫 Mort Ticket Opened', description: [`**Owner:** <@${interaction.user.id}>`, `**Reason:** ${cleanedReason}`, '', 'Staff can press **Claim**. Press **Close Ticket** when finished.'].join('\n'), color: COLORS.royalPurple })],
      components: ticketControls()
    });

    created = true;
    await sendLog(interaction.guild, memory, '🎫 Ticket Opened', `<@${interaction.user.id}> opened ${channel}.\nReason: ${cleanedReason}`, COLORS.lightBlue);
    return interaction.editReply({ embeds: [themedEmbed({ title: '✅ Ticket Created', description: `Your private ticket is ready: ${channel}`, color: COLORS.success })] });
  } finally {
    openingTickets.delete(key);
    if (!created) clearCooldown(`ticket-open:${interaction.guild.id}`, interaction.user.id);
  }
}

async function claimTicket(interaction) {
  const memory = getGuild(interaction.guild.id);
  const ticket = memory.tickets?.[interaction.channel.id];
  if (!ticket) return interaction.reply({ ephemeral: true, content: 'This is not a Mort ticket channel.' });
  if (!isTicketStaff(interaction)) return interaction.reply({ ephemeral: true, content: 'Only ticket staff can claim tickets.' });
  if (ticket.claimedBy) return interaction.reply({ ephemeral: true, content: `This ticket is already claimed by <@${ticket.claimedBy}>.` });

  updateGuild(interaction.guild.id, (guildMemory) => {
    const current = guildMemory.tickets[interaction.channel.id];
    if (current) Object.assign(current, { claimedBy: interaction.user.id, claimedAt: new Date().toISOString() });
  });
  await sendLog(interaction.guild, memory, '🛡️ Ticket Claimed', `${interaction.channel} was claimed by <@${interaction.user.id}>.`, COLORS.lightBlue);
  return interaction.reply({ embeds: [themedEmbed({ title: '🛡️ Ticket Claimed', description: `<@${interaction.user.id}> claimed this ticket.`, color: COLORS.lightBlue })] });
}

async function unclaimTicket(interaction) {
  const memory = getGuild(interaction.guild.id);
  const ticket = memory.tickets?.[interaction.channel.id];
  if (!ticket) return interaction.reply({ ephemeral: true, content: 'This is not a Mort ticket channel.' });
  if (!isTicketStaff(interaction)) return interaction.reply({ ephemeral: true, content: 'Only ticket staff can release ticket claims.' });
  if (!ticket.claimedBy) return interaction.reply({ ephemeral: true, content: 'This ticket is not currently claimed.' });
  const canReleaseOther = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  if (ticket.claimedBy !== interaction.user.id && !canReleaseOther) {
    return interaction.reply({ ephemeral: true, content: 'Only the current claimant or a server manager can release this claim.' });
  }

  const previousClaimant = ticket.claimedBy;
  updateGuild(interaction.guild.id, (guildMemory) => {
    const current = guildMemory.tickets[interaction.channel.id];
    if (current) {
      delete current.claimedBy;
      delete current.claimedAt;
    }
  });
  await sendLog(interaction.guild, memory, '🔓 Ticket Unclaimed', `${interaction.channel} was released by <@${interaction.user.id}> (previous claimant: <@${previousClaimant}>).`, COLORS.lightBlue);
  return interaction.reply({ embeds: [themedEmbed({ title: '🔓 Ticket Unclaimed', description: `<@${interaction.user.id}> released this ticket. Any staff member can claim it now.`, color: COLORS.lightBlue })] });
}

async function buildTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return null;
  const ordered = [...messages.values()].reverse();
  const lines = ordered.map((msg) => {
    const content = msg.content || (msg.embeds.length ? '[embed]' : msg.attachments.size ? '[attachment]' : '');
    return `[${msg.createdAt.toISOString()}] ${msg.author?.tag || 'Unknown'}: ${content}`;
  });
  return `Transcript for #${channel.name}\nGenerated: ${new Date().toISOString()}\n\n${lines.join('\n')}`;
}

async function closeTicket(interaction, reason = 'No reason provided.') {
  const memory = getGuild(interaction.guild.id);
  const ticket = memory.tickets?.[interaction.channel.id];
  if (!ticket) return interaction.reply({ ephemeral: true, content: 'This is not a Mort ticket channel.' });
  const isOwner = ticket.ownerId === interaction.user.id;
  if (!isOwner && !isTicketStaff(interaction)) return interaction.reply({ ephemeral: true, content: 'Only the ticket owner or staff can close this ticket.' });

  const cleanedReason = cleanTicketReason(reason);
  await interaction.reply({ embeds: [themedEmbed({ title: '🔒 Closing Ticket', description: `Mort is closing this ticket in 5 seconds.\nReason: ${cleanedReason}`, color: COLORS.warning })] });
  const transcript = await buildTranscript(interaction.channel).catch(() => null);
  if (transcript) {
    const logChannel = await getLogChannel(interaction.guild, memory);
    if (logChannel) {
      const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: `transcript-${interaction.channel.name}.txt` });
      await logChannel.send({ embeds: [themedEmbed({ title: '🧾 Ticket Transcript', description: `Ticket **${interaction.channel.name}** (owner <@${ticket.ownerId}>) closed by <@${interaction.user.id}>.\nReason: ${cleanedReason}`, color: COLORS.muted })], files: [attachment] }).catch(() => null);
    }
  }
  removeTicket(interaction.guild.id, interaction.channel.id);
  await sendLog(interaction.guild, memory, '🔒 Ticket Closed', `${interaction.channel.name} was closed by <@${interaction.user.id}>.\nReason: ${cleanedReason}`, COLORS.warning);
  setTimeout(() => interaction.channel.delete('Mort ticket closed').catch(() => null), 5000).unref?.();
}

module.exports = { TICKET_OPEN_COOLDOWN_MS, openTicket, claimTicket, unclaimTicket, closeTicket, buildTranscript, isTicketStaff };
