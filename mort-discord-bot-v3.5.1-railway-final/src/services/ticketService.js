const {
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder
} = require('discord.js');
const { getGuild, addTicket, removeTicket, updateGuild } = require('./dataStore');
const { ticketControls } = require('./panelService');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { sendLog, getLogChannel } = require('../utils/logger');

function safeTicketName(username) {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 18) || 'member';
}

function ticketOverwrites(guild, member, memory) {
  const staffRoleIds = [
    memory.roles?.owner,
    memory.roles?.admin,
    memory.roles?.moderator,
    memory.roles?.helper
  ].filter(Boolean);

  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    ...staffRoleIds.map((id) => ({
      id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    }))
  ];
}

async function openTicket(interaction, reason = 'No reason provided.') {
  await interaction.deferReply({ ephemeral: true });
  const memory = getGuild(interaction.guild.id);
  const ticketCategoryId = memory.config?.ticketCategoryId || memory.categories?.support;
  const category = ticketCategoryId ? await interaction.guild.channels.fetch(ticketCategoryId).catch(() => null) : null;

  const openExisting = Object.entries(memory.tickets || {}).find(([, ticket]) => ticket.ownerId === interaction.user.id && ticket.status === 'open');
  if (openExisting) {
    const [existingChannelId] = openExisting;
    const stillExists = await interaction.guild.channels.fetch(existingChannelId).catch(() => null);
    if (stillExists) {
      return interaction.editReply({
        embeds: [themedEmbed({
          title: '🎫 Ticket Already Open',
          description: `You already have a ticket: <#${existingChannelId}>`,
          color: COLORS.warning
        })]
      });
    }
    // The channel was deleted outside of /ticket close (e.g. manually by
    // staff), leaving a stale record that would otherwise block this user
    // from ever opening another ticket. Clean it up and continue.
    removeTicket(interaction.guild.id, existingChannelId);
  }

  const name = `ticket-${safeTicketName(interaction.user.username)}`;
  const channel = await interaction.guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: category?.id,
    topic: `Mort ticket for ${interaction.user.tag} • ${reason}`,
    permissionOverwrites: ticketOverwrites(interaction.guild, interaction.member, memory),
    reason: `Mort ticket opened by ${interaction.user.tag}`
  });

  addTicket(interaction.guild.id, channel.id, {
    ownerId: interaction.user.id,
    ownerTag: interaction.user.tag,
    reason,
    status: 'open',
    openedAt: new Date().toISOString()
  });

  await channel.send({
    content: `<@${interaction.user.id}>`,
    embeds: [themedEmbed({
      title: '🎫 Mort Ticket Opened',
      description: [
        `**Owner:** <@${interaction.user.id}>`,
        `**Reason:** ${reason}`,
        '',
        'Staff can press **Claim**. Press **Close Ticket** when finished.'
      ].join('\n'),
      color: COLORS.royalPurple
    })],
    components: ticketControls()
  });

  await sendLog(interaction.guild, memory, '🎫 Ticket Opened', `<@${interaction.user.id}> opened ${channel}.\nReason: ${reason}`, COLORS.lightBlue);

  return interaction.editReply({
    embeds: [themedEmbed({
      title: '✅ Ticket Created',
      description: `Your private ticket is ready: ${channel}`,
      color: COLORS.success
    })]
  });
}

async function claimTicket(interaction) {
  const memory = getGuild(interaction.guild.id);
  const ticket = memory.tickets?.[interaction.channel.id];
  if (!ticket) {
    return interaction.reply({ ephemeral: true, content: 'This is not a Mort ticket channel.' });
  }
  if (ticket.claimedBy) {
    return interaction.reply({ ephemeral: true, content: `This ticket is already claimed by <@${ticket.claimedBy}>.` });
  }

  updateGuild(interaction.guild.id, (guildMemory) => {
    if (guildMemory.tickets[interaction.channel.id]) {
      guildMemory.tickets[interaction.channel.id].claimedBy = interaction.user.id;
      guildMemory.tickets[interaction.channel.id].claimedAt = new Date().toISOString();
    }
  });

  await interaction.reply({
    embeds: [themedEmbed({
      title: '🛡️ Ticket Claimed',
      description: `<@${interaction.user.id}> claimed this ticket.`,
      color: COLORS.lightBlue
    })]
  });
}

async function unclaimTicket(interaction) {
  const memory = getGuild(interaction.guild.id);
  const ticket = memory.tickets?.[interaction.channel.id];
  if (!ticket) {
    return interaction.reply({ ephemeral: true, content: 'This is not a Mort ticket channel.' });
  }
  if (!ticket.claimedBy) {
    return interaction.reply({ ephemeral: true, content: 'This ticket is not currently claimed.' });
  }

  updateGuild(interaction.guild.id, (guildMemory) => {
    if (guildMemory.tickets[interaction.channel.id]) {
      delete guildMemory.tickets[interaction.channel.id].claimedBy;
      delete guildMemory.tickets[interaction.channel.id].claimedAt;
    }
  });

  await interaction.reply({
    embeds: [themedEmbed({
      title: '🔓 Ticket Unclaimed',
      description: `<@${interaction.user.id}> unclaimed this ticket. Any staff member can claim it now.`,
      color: COLORS.lightBlue
    })]
  });
}

async function buildTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return null;
  const ordered = [...messages.values()].reverse();
  const lines = ordered.map((msg) => {
    const time = msg.createdAt.toISOString();
    const author = msg.author?.tag || 'Unknown';
    const content = msg.content || (msg.embeds.length ? '[embed]' : msg.attachments.size ? '[attachment]' : '');
    return `[${time}] ${author}: ${content}`;
  });
  return `Transcript for #${channel.name}\nGenerated: ${new Date().toISOString()}\n\n${lines.join('\n')}`;
}

async function closeTicket(interaction, reason = 'No reason provided.') {
  const memory = getGuild(interaction.guild.id);
  const ticket = memory.tickets?.[interaction.channel.id];
  if (!ticket) {
    return interaction.reply({ ephemeral: true, content: 'This is not a Mort ticket channel.' });
  }

  const isOwner = ticket.ownerId === interaction.user.id;
  const canManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  if (!isOwner && !canManage) {
    return interaction.reply({ ephemeral: true, content: 'Only the ticket owner or staff can close this ticket.' });
  }

  await interaction.reply({
    embeds: [themedEmbed({
      title: '🔒 Closing Ticket',
      description: `Mort is closing this ticket in 5 seconds.\nReason: ${reason}`,
      color: COLORS.warning
    })]
  });

  const transcript = await buildTranscript(interaction.channel).catch(() => null);
  if (transcript) {
    const logChannel = await getLogChannel(interaction.guild, memory);
    if (logChannel) {
      const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: `transcript-${interaction.channel.name}.txt` });
      await logChannel.send({
        embeds: [themedEmbed({
          title: '🧾 Ticket Transcript',
          description: `Ticket **${interaction.channel.name}** (owner <@${ticket.ownerId}>) closed by <@${interaction.user.id}>.\nReason: ${reason}`,
          color: COLORS.muted
        })],
        files: [attachment]
      }).catch(() => null);
    }
  }

  removeTicket(interaction.guild.id, interaction.channel.id);
  await sendLog(interaction.guild, memory, '🔒 Ticket Closed', `${interaction.channel.name} was closed by <@${interaction.user.id}>.\nReason: ${reason}`, COLORS.warning);
  setTimeout(() => interaction.channel.delete('Mort ticket closed').catch(() => null), 5000);
}

module.exports = {
  openTicket,
  claimTicket,
  unclaimTicket,
  closeTicket
};
