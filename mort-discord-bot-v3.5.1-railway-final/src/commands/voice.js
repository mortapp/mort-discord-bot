const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuild } = require('../services/dataStore');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');

function getOwnedVoiceRoom(interaction) {
  const memory = getGuild(interaction.guild.id);
  const voiceChannel = interaction.member.voice?.channel;
  if (!voiceChannel) return { error: 'Join your custom voice room first.' };

  const room = memory.tempVoiceRooms?.[voiceChannel.id];
  if (!room) return { error: 'This command only works inside a Mort custom voice room.' };
  if (room.ownerId !== interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
    return { error: 'Only the room owner or staff can control this room.' };
  }
  return { channel: voiceChannel, room, memory };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voice')
    .setDescription('Control your Mort custom voice room.')
    .addSubcommand((sub) => sub
      .setName('rename')
      .setDescription('Rename your custom voice room.')
      .addStringOption((opt) => opt.setName('name').setDescription('New room name.').setMinLength(2).setMaxLength(80).setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('lock')
      .setDescription('Lock your custom voice room.'))
    .addSubcommand((sub) => sub
      .setName('unlock')
      .setDescription('Unlock your custom voice room.'))
    .addSubcommand((sub) => sub
      .setName('limit')
      .setDescription('Set a user limit for your custom voice room.')
      .addIntegerOption((opt) => opt.setName('amount').setDescription('0 removes the limit.').setMinValue(0).setMaxValue(99).setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const result = getOwnedVoiceRoom(interaction);
    if (result.error) return interaction.reply({ ephemeral: true, content: result.error });
    const { channel, memory } = result;

    if (subcommand === 'rename') {
      const name = interaction.options.getString('name', true);
      await channel.setName(`🔊│${name}`, 'Mort custom voice rename');
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '✅ Voice Room Renamed', description: `Room name set to **${name}**.`, color: COLORS.success })] });
    }

    if (subcommand === 'lock') {
      for (const roleId of [memory.roles?.member, memory.roles?.verified].filter(Boolean)) {
        await channel.permissionOverwrites.edit(roleId, { Connect: false }, { reason: 'Mort custom voice lock' }).catch(() => null);
      }
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🔒 Voice Room Locked', description: 'Only the owner, staff, and manually allowed members can join.', color: COLORS.warning })] });
    }

    if (subcommand === 'unlock') {
      for (const roleId of [memory.roles?.member, memory.roles?.verified].filter(Boolean)) {
        await channel.permissionOverwrites.edit(roleId, { Connect: true }, { reason: 'Mort custom voice unlock' }).catch(() => null);
      }
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🔓 Voice Room Unlocked', description: 'Verified members can join again.', color: COLORS.success })] });
    }

    if (subcommand === 'limit') {
      const amount = interaction.options.getInteger('amount', true);
      await channel.setUserLimit(amount, 'Mort custom voice limit');
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🔊 Voice Limit Updated', description: amount === 0 ? 'User limit removed.' : `User limit set to **${amount}**.`, color: COLORS.lightBlue })] });
    }

    return null;
  }
};
