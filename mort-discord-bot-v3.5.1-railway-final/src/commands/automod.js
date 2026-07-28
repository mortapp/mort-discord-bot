const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { updateGuild, getGuild } = require('../services/dataStore');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { requireManageGuild } = require('../utils/guards');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure Mort automod.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('anti-invite')
      .setDescription('Turn Discord invite blocking on/off.')
      .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable invite blocking?').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('anti-scam')
      .setDescription('Turn scam/phishing link detection on/off.')
      .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable scam detection?').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('badword-add')
      .setDescription('Add a blocked word/phrase.')
      .addStringOption((opt) => opt.setName('phrase').setDescription('Word or phrase to block.').setMinLength(2).setMaxLength(80).setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('badword-remove')
      .setDescription('Remove a blocked word/phrase.')
      .addStringOption((opt) => opt.setName('phrase').setDescription('Word or phrase to unblock.').setMinLength(2).setMaxLength(80).setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('max-mentions')
      .setDescription('Set the max mentions allowed in one message before Mort deletes it.')
      .addIntegerOption((opt) => opt.setName('amount').setDescription('0 disables it. Good value: 6.').setMinValue(0).setMaxValue(50).setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('max-caps')
      .setDescription('Set the max caps-lock percentage allowed before Mort deletes a message.')
      .addIntegerOption((opt) => opt.setName('percent').setDescription('0 disables it. Good value: 70.').setMinValue(0).setMaxValue(100).setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('spam-filter')
      .setDescription('Configure flood/spam detection.')
      .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable spam filter?').setRequired(true))
      .addIntegerOption((opt) => opt.setName('max_messages').setDescription('Max messages allowed in the time window.').setMinValue(2).setMaxValue(30).setRequired(false))
      .addIntegerOption((opt) => opt.setName('window_seconds').setDescription('Time window in seconds.').setMinValue(2).setMaxValue(60).setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('bypass-role')
      .setDescription('Add or remove a role that bypasses automod.')
      .addStringOption((opt) => opt.setName('action').setDescription('Add or remove.').setRequired(true)
        .addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }))
      .addRoleOption((opt) => opt.setName('role').setDescription('Role to bypass automod.').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('bypass-channel')
      .setDescription('Add or remove a channel that bypasses automod.')
      .addStringOption((opt) => opt.setName('action').setDescription('Add or remove.').setRequired(true)
        .addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }))
      .addChannelOption((opt) => opt.setName('channel').setDescription('Channel to bypass automod.').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('status')
      .setDescription('Show automod status.')),

  async execute(interaction) {
    requireManageGuild(interaction);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'anti-invite') {
      const enabled = interaction.options.getBoolean('enabled', true);
      updateGuild(interaction.guild.id, (guild) => {
        guild.config.automod = { ...(guild.config.automod || {}), antiInvite: enabled };
      });
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🛡️ Automod Updated', description: `Anti-invite is now **${enabled ? 'enabled' : 'disabled'}**.`, color: COLORS.lightBlue })] });
    }

    if (subcommand === 'anti-scam') {
      const enabled = interaction.options.getBoolean('enabled', true);
      updateGuild(interaction.guild.id, (guild) => {
        guild.config.automod = { ...(guild.config.automod || {}), antiScam: enabled };
      });
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🛡️ Automod Updated', description: `Scam/phishing detection is now **${enabled ? 'enabled' : 'disabled'}**.`, color: COLORS.lightBlue })] });
    }

    if (subcommand === 'badword-add') {
      const phrase = interaction.options.getString('phrase', true).toLowerCase().trim();
      updateGuild(interaction.guild.id, (guild) => {
        const automod = guild.config.automod || {};
        const phrases = new Set(automod.blockedPhrases || []);
        phrases.add(phrase);
        guild.config.automod = { ...automod, blockedPhrases: [...phrases] };
      });
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🛡️ Blocked Phrase Added', description: `Mort will now block: \`${phrase}\``, color: COLORS.success })] });
    }

    if (subcommand === 'badword-remove') {
      const phrase = interaction.options.getString('phrase', true).toLowerCase().trim();
      updateGuild(interaction.guild.id, (guild) => {
        const automod = guild.config.automod || {};
        guild.config.automod = {
          ...automod,
          blockedPhrases: (automod.blockedPhrases || []).filter((item) => item !== phrase)
        };
      });
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🛡️ Blocked Phrase Removed', description: `Mort removed: \`${phrase}\``, color: COLORS.warning })] });
    }

    if (subcommand === 'max-mentions') {
      const amount = interaction.options.getInteger('amount', true);
      updateGuild(interaction.guild.id, (guild) => {
        const automod = guild.config.automod || {};
        guild.config.automod = { ...automod, maxMentions: amount };
      });
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🛡️ Max Mentions Updated', description: amount ? `Mort will delete messages with **${amount}+ mentions**.` : 'Mass mention protection disabled.', color: COLORS.lightBlue })] });
    }

    if (subcommand === 'max-caps') {
      const percent = interaction.options.getInteger('percent', true);
      updateGuild(interaction.guild.id, (guild) => {
        const automod = guild.config.automod || {};
        guild.config.automod = { ...automod, maxCapsPercent: percent };
      });
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🛡️ Caps Lock Filter Updated', description: percent ? `Mort will delete messages that are **${percent}%+** caps.` : 'Caps lock protection disabled.', color: COLORS.lightBlue })] });
    }

    if (subcommand === 'spam-filter') {
      const enabled = interaction.options.getBoolean('enabled', true);
      const maxMessages = interaction.options.getInteger('max_messages');
      const windowSeconds = interaction.options.getInteger('window_seconds');
      updateGuild(interaction.guild.id, (guild) => {
        const automod = guild.config.automod || {};
        const spamFilter = { ...(automod.spamFilter || {}), enabled };
        if (maxMessages) spamFilter.maxMessages = maxMessages;
        if (windowSeconds) spamFilter.windowSeconds = windowSeconds;
        guild.config.automod = { ...automod, spamFilter };
      });
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🛡️ Spam Filter Updated', description: `Spam/flood detection is now **${enabled ? 'enabled' : 'disabled'}**.`, color: COLORS.lightBlue })] });
    }

    if (subcommand === 'bypass-role') {
      const action = interaction.options.getString('action', true);
      const role = interaction.options.getRole('role', true);
      updateGuild(interaction.guild.id, (guild) => {
        const automod = guild.config.automod || {};
        const set = new Set(automod.bypassRoleIds || []);
        if (action === 'add') set.add(role.id); else set.delete(role.id);
        guild.config.automod = { ...automod, bypassRoleIds: [...set] };
      });
      return interaction.reply({ ephemeral: true, content: `🛡️ ${role} ${action === 'add' ? 'now bypasses' : 'no longer bypasses'} automod.` });
    }

    if (subcommand === 'bypass-channel') {
      const action = interaction.options.getString('action', true);
      const channel = interaction.options.getChannel('channel', true);
      updateGuild(interaction.guild.id, (guild) => {
        const automod = guild.config.automod || {};
        const set = new Set(automod.bypassChannelIds || []);
        if (action === 'add') set.add(channel.id); else set.delete(channel.id);
        guild.config.automod = { ...automod, bypassChannelIds: [...set] };
      });
      return interaction.reply({ ephemeral: true, content: `🛡️ ${channel} ${action === 'add' ? 'now bypasses' : 'no longer bypasses'} automod.` });
    }

    if (subcommand === 'status') {
      const memory = getGuild(interaction.guild.id);
      const automod = memory.config.automod || {};
      const phrases = automod.blockedPhrases?.length ? automod.blockedPhrases.map((p) => `\`${p}\``).join(', ') : 'none';
      const bypassRoles = automod.bypassRoleIds?.length ? automod.bypassRoleIds.map((id) => `<@&${id}>`).join(', ') : 'none';
      const bypassChannels = automod.bypassChannelIds?.length ? automod.bypassChannelIds.map((id) => `<#${id}>`).join(', ') : 'none';
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({
        title: '🛡️ Mort Automod Status',
        description: [
          `Anti-invite: **${automod.antiInvite ? 'enabled' : 'disabled'}**`,
          `Anti-scam: **${automod.antiScam !== false ? 'enabled' : 'disabled'}**`,
          `Max mentions: **${automod.maxMentions || 0}**`,
          `Max caps: **${automod.maxCapsPercent || 0}%**`,
          `Spam filter: **${automod.spamFilter?.enabled ? 'enabled' : 'disabled'}** (${automod.spamFilter?.maxMessages || 5} msgs / ${automod.spamFilter?.windowSeconds || 6}s)`,
          `Blocked phrases: ${phrases}`,
          `Bypass roles: ${bypassRoles}`,
          `Bypass channels: ${bypassChannels}`
        ].join('\n'),
        color: COLORS.royalPurple
      })] });
    }

    return null;
  }
};
