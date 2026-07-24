const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { getGuild } = require('../services/dataStore');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { sendLog } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('community')
    .setDescription('Mort community utilities: suggestions, reports, polls, and server info.')
    .addSubcommand((sub) => sub
      .setName('suggest')
      .setDescription('Send a suggestion to the suggestions channel.')
      .addStringOption((opt) => opt.setName('idea').setDescription('Your suggestion.').setMaxLength(1000).setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('report')
      .setDescription('Privately report a member to staff.')
      .addUserOption((opt) => opt.setName('user').setDescription('Who are you reporting?').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('What happened?').setMaxLength(1000).setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('poll')
      .setDescription('Create a clean yes/no poll.')
      .addStringOption((opt) => opt.setName('question').setDescription('Poll question.').setMaxLength(250).setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('serverinfo')
      .setDescription('Show server information.'))
    .addSubcommand((sub) => sub
      .setName('userinfo')
      .setDescription('Show user information.')
      .addUserOption((opt) => opt.setName('user').setDescription('User to inspect.').setRequired(false))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const memory = getGuild(interaction.guild.id);

    if (subcommand === 'suggest') {
      const idea = interaction.options.getString('idea', true);
      const channelId = memory.channels?.suggestions || memory.channels?.ideas || memory.channels?.featureIdeas;
      const channel = channelId ? await interaction.guild.channels.fetch(channelId).catch(() => null) : interaction.channel;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`suggest:up:${interaction.id}`).setLabel('Upvote').setEmoji('⬆️').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId(`suggest:down:${interaction.id}`).setLabel('Downvote').setEmoji('⬇️').setStyle(ButtonStyle.Danger).setDisabled(true)
      );
      await channel.send({
        embeds: [themedEmbed({
          title: '💡 Mort Suggestion',
          description: idea,
          color: COLORS.lightBlue,
          fields: [{ name: 'Suggested by', value: `${interaction.user}`, inline: true }]
        })],
        components: [row]
      });
      return interaction.reply({ ephemeral: true, content: `✅ Suggestion sent to ${channel}.` });
    }

    if (subcommand === 'report') {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason', true);
      await sendLog(interaction.guild, memory, '🚨 Member Report', [
        `**Reporter:** ${interaction.user} (${interaction.user.id})`,
        `**Reported:** ${user} (${user.id})`,
        `**Reason:** ${reason}`
      ].join('\n'), COLORS.danger);
      return interaction.reply({ ephemeral: true, content: '✅ Report sent privately to staff. Do not argue in public; staff will handle it.' });
    }

    if (subcommand === 'poll') {
      const question = interaction.options.getString('question', true);
      const message = await interaction.reply({
        fetchReply: true,
        embeds: [themedEmbed({
          title: '📊 Mort Poll',
          description: question,
          color: COLORS.royalPurple,
          fields: [{ name: 'Vote', value: 'React with ✅ or ❌.' }]
        })]
      });
      await message.react('✅').catch(() => null);
      await message.react('❌').catch(() => null);
      return null;
    }

    if (subcommand === 'serverinfo') {
      const owner = await interaction.guild.fetchOwner().catch(() => null);
      return interaction.reply({ embeds: [themedEmbed({
        title: `🧭 ${interaction.guild.name}`,
        description: [
          `Members: **${interaction.guild.memberCount}**`,
          `Owner: ${owner ? `${owner.user}` : 'Unknown'}`,
          `Created: <t:${Math.floor(interaction.guild.createdTimestamp / 1000)}:D>`,
          `Verification gate: **${memory.config?.verificationLocked !== false ? 'ON' : 'OFF'}**`
        ].join('\n'),
        color: COLORS.lightBlue
      })] });
    }

    if (subcommand === 'userinfo') {
      const user = interaction.options.getUser('user') || interaction.user;
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      const roles = member?.roles?.cache
        ?.filter((role) => role.id !== interaction.guild.id)
        ?.map((role) => `${role}`)
        ?.slice(0, 12)
        ?.join(', ') || 'No roles';
      return interaction.reply({ embeds: [themedEmbed({
        title: `👤 ${user.username}`,
        description: [
          `User: ${user}`,
          `ID: **${user.id}**`,
          `Joined: ${member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown'}`,
          `Created: <t:${Math.floor(user.createdTimestamp / 1000)}:D>`,
          `Roles: ${roles}`
        ].join('\n'),
        color: COLORS.royalPurple
      })] });
    }

    return null;
  }
};
