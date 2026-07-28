const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { getGuild, updateGuild } = require('./dataStore');
const { sendLog } = require('../utils/logger');

const DEFAULT_WELCOME_MESSAGE = 'Welcome {user} to **{server}** ✦ You are member **#{memberCount}**. Read {rules} and verify in {verify}.';
const DEFAULT_GOODBYE_MESSAGE = '**{tag}** left **{server}**. Mort saved the exit in the logs.';

function welcomeDefaults(memory = {}) {
  const channels = memory.channels || {};
  const config = memory.config || {};

  return {
    welcomeEnabled: config.welcomeEnabled ?? true,
    goodbyeEnabled: config.goodbyeEnabled ?? true,
    welcomeChannelId: config.welcomeChannelId || channels.welcome || null,
    goodbyeChannelId: config.goodbyeChannelId || channels.goodbye || channels.welcome || null,
    autoRoleEnabled: config.autoRoleEnabled ?? true,
    autoRoleId: config.autoRoleId || config.unverifiedRoleId || memory.roles?.unverified || null,
    welcomeMessage: config.welcomeMessage || DEFAULT_WELCOME_MESSAGE,
    goodbyeMessage: config.goodbyeMessage || DEFAULT_GOODBYE_MESSAGE
  };
}

function renderTemplate(template, guild, userOrMember, extra = {}) {
  const user = userOrMember?.user || userOrMember;
  const memberCount = guild.memberCount ?? extra.memberCount ?? 'unknown';
  const memory = getGuild(guild.id);
  const rules = memory.channels?.rules ? `<#${memory.channels.rules}>` : '#rules';
  const verify = memory.channels?.verify ? `<#${memory.channels.verify}>` : '#verify';

  return String(template || '')
    .replaceAll('{user}', user ? `<@${user.id}>` : 'this member')
    .replaceAll('{username}', user?.username || 'Unknown')
    .replaceAll('{tag}', user?.tag || user?.username || 'Unknown user')
    .replaceAll('{id}', user?.id || 'unknown')
    .replaceAll('{server}', guild.name)
    .replaceAll('{memberCount}', String(memberCount))
    .replaceAll('{rules}', rules)
    .replaceAll('{verify}', verify);
}

async function fetchTextChannel(guild, channelId) {
  if (!channelId) return null;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText || !channel.isTextBased()) return null;
  return channel;
}

function memberAvatar(memberOrUser) {
  const user = memberOrUser?.user || memberOrUser;
  return user?.displayAvatarURL?.({ size: 256 }) || null;
}

function buildWelcomeEmbed(member, config) {
  const description = renderTemplate(config.welcomeMessage, member.guild, member);
  const embed = themedEmbed({
    title: '✦ Welcome to Mort',
    description,
    color: COLORS.royalPurple,
    fields: [
      { name: 'Member', value: `${member}`, inline: true },
      { name: 'Total Members', value: `${member.guild.memberCount}`, inline: true }
    ]
  });

  const avatar = memberAvatar(member);
  if (avatar) embed.setThumbnail(avatar);
  return embed;
}

function buildGoodbyeEmbed(member, config) {
  const description = renderTemplate(config.goodbyeMessage, member.guild, member, {
    memberCount: Math.max((member.guild.memberCount || 1) - 1, 0)
  });
  const embed = themedEmbed({
    title: '◇ Member Left',
    description,
    color: COLORS.lightBlue,
    fields: [
      { name: 'User', value: `${member.user?.tag || member.user?.username || 'Unknown user'}`, inline: true },
      { name: 'User ID', value: `${member.id}`, inline: true }
    ]
  });

  const avatar = memberAvatar(member);
  if (avatar) embed.setThumbnail(avatar);
  return embed;
}

async function handleGuildMemberAdd(member) {
  const memory = getGuild(member.guild.id);
  const config = welcomeDefaults(memory);

  if (config.autoRoleEnabled && config.autoRoleId) {
    const role = await member.guild.roles.fetch(config.autoRoleId).catch(() => null);
    if (role) await member.roles.add(role, 'Mort pre-verification role').catch(() => null);
  }

  if (!config.welcomeEnabled) return;

  const channel = await fetchTextChannel(member.guild, config.welcomeChannelId);
  if (!channel) return;

  await channel.send({
    content: `${member}`,
    embeds: [buildWelcomeEmbed(member, config)]
  }).catch(() => null);
}

async function handleGuildMemberRemove(member) {
  const memory = getGuild(member.guild.id);
  const config = welcomeDefaults(memory);

  if (!config.goodbyeEnabled) return;

  const channel = await fetchTextChannel(member.guild, config.goodbyeChannelId);
  if (!channel) return;

  await channel.send({
    embeds: [buildGoodbyeEmbed(member, config)]
  }).catch(() => null);
}


async function sendVerifiedWelcome(member) {
  const memory = getGuild(member.guild.id);
  const config = welcomeDefaults(memory);
  if (!config.welcomeEnabled) return;
  const channel = await fetchTextChannel(member.guild, config.welcomeChannelId);
  if (!channel) return;
  await channel.send({
    content: `${member}`,
    embeds: [themedEmbed({
      title: '✅ Member Verified',
      description: `${member} unlocked **${member.guild.name}** and received the Member role. Welcome to Mort.`,
      color: COLORS.success,
      fields: [{ name: 'Next Step', value: memory.channels?.serverMap ? `Check <#${memory.channels.serverMap}>.` : 'Check the server map.' }]
    })]
  }).catch(() => null);
}

function setWelcomeConfig(guildId, patch) {
  return updateGuild(guildId, (guildMemory) => {
    guildMemory.config = {
      ...(guildMemory.config || {}),
      ...patch
    };
  });
}

function statusText(memory) {
  const config = welcomeDefaults(memory);
  return [
    `Welcome: **${config.welcomeEnabled ? 'ON' : 'OFF'}**`,
    `Goodbye: **${config.goodbyeEnabled ? 'ON' : 'OFF'}**`,
    `Welcome channel: ${config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : 'not set'}`,
    `Goodbye channel: ${config.goodbyeChannelId ? `<#${config.goodbyeChannelId}>` : 'not set'}`,
    `Join role: **${config.autoRoleEnabled ? 'ON' : 'OFF'}** ${config.autoRoleId ? `(<@&${config.autoRoleId}>)` : ''} — verified members receive Member after pressing Verify`,
    '',
    '**Placeholders**',
    '`{user}` `{username}` `{tag}` `{id}` `{server}` `{memberCount}` `{rules}` `{verify}`'
  ].join('\n');
}

async function testWelcome(interaction, type, targetUser) {
  const memory = getGuild(interaction.guild.id);
  const config = welcomeDefaults(memory);
  const member = targetUser
    ? await interaction.guild.members.fetch(targetUser.id).catch(() => interaction.member)
    : interaction.member;

  const embed = type === 'goodbye'
    ? buildGoodbyeEmbed(member, config)
    : buildWelcomeEmbed(member, config);

  return interaction.reply({
    ephemeral: true,
    embeds: [embed]
  });
}

async function sendConfiguredPreview(interaction, type) {
  const memory = getGuild(interaction.guild.id);
  const config = welcomeDefaults(memory);
  const member = interaction.member;
  const isGoodbye = type === 'goodbye';
  const channel = await fetchTextChannel(
    interaction.guild,
    isGoodbye ? config.goodbyeChannelId : config.welcomeChannelId
  );

  if (!channel) {
    return interaction.reply({
      ephemeral: true,
      embeds: [themedEmbed({
        title: '⚠️ Channel Missing',
        description: `Mort cannot find the configured ${type} channel. Set it with \`/welcome channel\` first.`,
        color: COLORS.warning
      })]
    });
  }

  await channel.send({
    content: isGoodbye ? undefined : `${member}`,
    embeds: [isGoodbye ? buildGoodbyeEmbed(member, config) : buildWelcomeEmbed(member, config)]
  });

  await sendLog(interaction.guild, memory, '👋 Welcome System Preview', `<@${interaction.user.id}> sent a ${type} preview in ${channel}.`, COLORS.lightBlue);
  return interaction.reply({ ephemeral: true, content: `✅ Sent ${type} preview in ${channel}.` });
}

module.exports = {
  DEFAULT_WELCOME_MESSAGE,
  DEFAULT_GOODBYE_MESSAGE,
  welcomeDefaults,
  handleGuildMemberAdd,
  handleGuildMemberRemove,
  sendVerifiedWelcome,
  setWelcomeConfig,
  statusText,
  testWelcome,
  sendConfiguredPreview
};
