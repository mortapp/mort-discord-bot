const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { getGuild, addTempVoiceRoom, removeTempVoiceRoom } = require('./dataStore');

async function handleVoiceStateUpdate(oldState, newState) {
  const guild = newState.guild || oldState.guild;
  const memory = getGuild(guild.id);
  const createRoomId = memory.config?.tempVoiceLobbyId || memory.channels?.createRoom;

  if (newState.channelId && newState.channelId === createRoomId) {
    const parentId = newState.channel?.parentId || memory.categories?.voice;
    const displayName = newState.member?.displayName || newState.member?.user?.username || 'Member';
    const room = await guild.channels.create({
      name: `🔊│${displayName}'s Room`,
      type: ChannelType.GuildVoice,
      parent: parentId || undefined,
      userLimit: 8,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        memory.roles?.member ? {
          id: memory.roles.member,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.UseVAD]
        } : null,
        memory.roles?.verified ? {
          id: memory.roles.verified,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.UseVAD]
        } : null,
        memory.roles?.unverified ? { id: memory.roles.unverified, deny: [PermissionFlagsBits.ViewChannel] } : null,
        {
          id: newState.member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.ManageChannels
          ]
        }
      ].filter(Boolean),
      reason: `Mort custom voice room for ${newState.member.user.tag}`
    });

    addTempVoiceRoom(guild.id, room.id, {
      ownerId: newState.member.id,
      ownerTag: newState.member.user.tag,
      createdAt: new Date().toISOString()
    });

    await newState.member.voice.setChannel(room, 'Mort custom voice room created').catch(() => null);
  }

  if (oldState.channelId && memory.tempVoiceRooms?.[oldState.channelId]) {
    const oldChannel = await guild.channels.fetch(oldState.channelId).catch(() => null);
    if (oldChannel && oldChannel.members.size === 0) {
      removeTempVoiceRoom(guild.id, oldState.channelId);
      await oldChannel.delete('Mort custom voice room empty').catch(() => null);
    }
  }
}

module.exports = {
  handleVoiceStateUpdate
};
