const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { assistantConfig, setAssistantConfig } = require('../services/assistantService');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { requireManageGuild } = require('../utils/guards');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('assistant')
    .setDescription('Configure Mort @mention question-answer assistant.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('status').setDescription('Show assistant settings.'))
    .addSubcommand((sub) => sub.setName('enable').setDescription('Enable @Mort question responses.'))
    .addSubcommand((sub) => sub.setName('disable').setDescription('Disable @Mort question responses.'))
    .addSubcommand((sub) => sub
      .setName('channel')
      .setDescription('Lock @Mort answers to one text channel, or clear the lock.')
      .addChannelOption((opt) => opt.setName('channel').setDescription('Channel for assistant answers. Leave blank to allow all channels.').addChannelTypes(ChannelType.GuildText).setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('cooldown')
      .setDescription('Set per-user assistant cooldown in seconds.')
      .addIntegerOption((opt) => opt.setName('seconds').setDescription('Cooldown seconds, 2-120.').setMinValue(2).setMaxValue(120).setRequired(true))),

  async execute(interaction) {
    requireManageGuild(interaction);
    const sub = interaction.options.getSubcommand();

    if (sub === 'enable') {
      setAssistantConfig(interaction.guild.id, { enabled: true });
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '✅ Assistant Enabled', description: 'Mort will answer when members mention him with a question.', color: COLORS.success })] });
    }

    if (sub === 'disable') {
      setAssistantConfig(interaction.guild.id, { enabled: false });
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🛑 Assistant Disabled', description: 'Mort will stop answering @mentions until enabled again.', color: COLORS.warning })] });
    }

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel');
      setAssistantConfig(interaction.guild.id, { channelId: channel?.id || null });
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🤖 Assistant Channel Updated', description: channel ? `Mort will answer @mentions only in ${channel}.` : 'Mort will answer @mentions in any text channel he can see.', color: COLORS.lightBlue })] });
    }

    if (sub === 'cooldown') {
      const seconds = interaction.options.getInteger('seconds', true);
      setAssistantConfig(interaction.guild.id, { cooldownSeconds: seconds });
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '⏱️ Assistant Cooldown Updated', description: `Mort answer cooldown is now **${seconds}s** per user.`, color: COLORS.lightBlue })] });
    }

    const config = assistantConfig(interaction.guild.id);
    return interaction.reply({ ephemeral: true, embeds: [themedEmbed({
      title: '🤖 Mort Assistant Status',
      description: [
        `Enabled: **${config.enabled ? 'ON' : 'OFF'}**`,
        `Channel lock: ${config.channelId ? `<#${config.channelId}>` : '**all channels**'}`,
        `Cooldown: **${config.cooldownSeconds}s**`,
        `Max response length: **${config.maxLength} chars**`,
        '',
        'Members can ask things like `@Mort how do I verify?` or `@Mort why missing permissions?`.'
      ].join('\n'),
      color: COLORS.royalPurple
    })] });
  }
};
