const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const { getGuild, updateGuild } = require('../services/dataStore');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');

function safeName(input) {
  return input.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'private-room';
}

function overwrites(guild, owner, extraMembers, memory, type) {
  const staffIds = [memory.roles?.owner, memory.roles?.admin, memory.roles?.moderator].filter(Boolean);
  const allowText = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];
  const allowVoice = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.UseVAD];
  const allow = type === 'voice' ? allowVoice : allowText;
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: owner.id, allow },
    ...extraMembers.map((member) => ({ id: member.id, allow })),
    ...staffIds.map((id) => ({ id, allow: [...allow, PermissionFlagsBits.ManageMessages] }))
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('private')
    .setDescription('Create and manage Mort private rooms.')
    .addSubcommand((sub) => sub
      .setName('create')
      .setDescription('Create a private text or voice room.')
      .addStringOption((opt) => opt.setName('name').setDescription('Room name.').setMaxLength(40).setRequired(true))
      .addStringOption((opt) => opt.setName('type').setDescription('Text or voice?').setRequired(true).addChoices(
        { name: 'Text', value: 'text' },
        { name: 'Voice', value: 'voice' }
      ))
      .addUserOption((opt) => opt.setName('user1').setDescription('Member to invite.').setRequired(false))
      .addUserOption((opt) => opt.setName('user2').setDescription('Another member.').setRequired(false))
      .addUserOption((opt) => opt.setName('user3').setDescription('Another member.').setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('delete')
      .setDescription('Delete this private room if you own it.')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const memory = getGuild(interaction.guild.id);

    if (subcommand === 'create') {
      const type = interaction.options.getString('type', true);
      const rawName = interaction.options.getString('name', true);
      const members = ['user1', 'user2', 'user3']
        .map((key) => interaction.options.getUser(key))
        .filter(Boolean)
        .filter((user, index, arr) => arr.findIndex((item) => item.id === user.id) === index)
        .map((user) => interaction.guild.members.cache.get(user.id))
        .filter(Boolean);
      const categoryId = memory.config?.privateCategoryId || memory.categories?.premium || memory.categories?.community;
      const category = categoryId ? await interaction.guild.channels.fetch(categoryId).catch(() => null) : null;
      const channel = await interaction.guild.channels.create({
        name: `🔐-${safeName(rawName)}`,
        type: type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
        parent: category?.id,
        permissionOverwrites: overwrites(interaction.guild, interaction.member, members, memory, type),
        reason: `Mort private room created by ${interaction.user.tag}`
      });

      updateGuild(interaction.guild.id, (guild) => {
        guild.privateRooms ||= {};
        guild.privateRooms[channel.id] = {
          ownerId: interaction.user.id,
          type,
          createdAt: new Date().toISOString()
        };
      });

      if (channel.isTextBased()) {
        await channel.send({
          embeds: [themedEmbed({
            title: '🔐 Private Room Created',
            description: `${interaction.user} owns this room. Staff can still see it for safety.`,
            color: COLORS.royalPurple
          })]
        }).catch(() => null);
      }

      return interaction.reply({ ephemeral: true, content: `✅ Private ${type} room created: ${channel}` });
    }

    if (subcommand === 'delete') {
      const room = memory.privateRooms?.[interaction.channel.id];
      const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
      if (!room || (room.ownerId !== interaction.user.id && !isStaff)) {
        return interaction.reply({ ephemeral: true, content: 'This is not your Mort private room.' });
      }
      updateGuild(interaction.guild.id, (guild) => {
        if (guild.privateRooms) delete guild.privateRooms[interaction.channel.id];
      });
      await interaction.reply({ ephemeral: true, content: 'Deleting private room...' });
      return interaction.channel.delete('Mort private room deleted').catch(() => null);
    }

    return null;
  }
};
