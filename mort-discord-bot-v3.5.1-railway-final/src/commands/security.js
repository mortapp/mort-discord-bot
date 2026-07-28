const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuild, updateGuild } = require('../services/dataStore');
const { setupServer } = require('../services/setupService');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { requireManageGuild } = require('../utils/guards');
const { antiNukeStatus, setAntiNuke, addToWhitelist, removeFromWhitelist } = require('../services/antinukeService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('security')
    .setDescription('Mort verification lock, anti-raid, anti-nuke, and permission refresh tools.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('status')
      .setDescription('Show Mort security status.'))
    .addSubcommand((sub) => sub
      .setName('refresh-perms')
      .setDescription('Re-apply Mort channel permissions without deleting channels.'))
    .addSubcommand((sub) => sub
      .setName('verification')
      .setDescription('Turn the verify gate on/off in Mort memory.')
      .addBooleanOption((opt) => opt.setName('locked').setDescription('Locked means unverified only sees verify.').setRequired(true)))
    .addSubcommandGroup((group) => group
      .setName('antinuke')
      .setDescription('Configure anti-nuke protection.')
      .addSubcommand((sub) => sub
        .setName('status')
        .setDescription('Show anti-nuke configuration and state.'))
      .addSubcommand((sub) => sub
        .setName('toggle')
        .setDescription('Enable or disable anti-nuke.')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable anti-nuke?').setRequired(true)))
      .addSubcommand((sub) => sub
        .setName('threshold')
        .setDescription('Set how many destructive actions trigger anti-nuke.')
        .addIntegerOption((opt) => opt.setName('actions').setDescription('Number of actions.').setMinValue(2).setMaxValue(50).setRequired(true))
        .addIntegerOption((opt) => opt.setName('window_seconds').setDescription('Time window in seconds.').setMinValue(5).setMaxValue(600).setRequired(false)))
      .addSubcommand((sub) => sub
        .setName('punishment')
        .setDescription('Set what happens to a detected nuker.')
        .addStringOption((opt) => opt.setName('type').setDescription('Punishment type.').setRequired(true)
          .addChoices(
            { name: 'Quarantine (strip roles + timeout)', value: 'quarantine' },
            { name: 'Kick', value: 'kick' },
            { name: 'Ban', value: 'ban' }
          )))
      .addSubcommand((sub) => sub
        .setName('bot-protection')
        .setDescription('Auto-kick bots added by non-whitelisted users.')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable bot-add protection?').setRequired(true)))
      .addSubcommand((sub) => sub
        .setName('whitelist-add')
        .setDescription('Allow a trusted user to bypass anti-nuke.')
        .addUserOption((opt) => opt.setName('user').setDescription('User to trust.').setRequired(true)))
      .addSubcommand((sub) => sub
        .setName('whitelist-remove')
        .setDescription('Remove a user from the anti-nuke whitelist.')
        .addUserOption((opt) => opt.setName('user').setDescription('User to remove.').setRequired(true)))),

  async execute(interaction) {
    requireManageGuild(interaction);
    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    if (group === 'antinuke') {
      if (subcommand === 'status') {
        const config = antiNukeStatus(interaction.guild.id);
        return interaction.reply({
          ephemeral: true,
          embeds: [themedEmbed({
            title: '🚨 Anti-Nuke Status',
            description: [
              `Enabled: **${config.enabled ? 'ON' : 'OFF'}**`,
              `Threshold: **${config.threshold}** actions / **${config.windowSeconds}s**`,
              `Punishment: **${config.punishment}**`,
              `Bot-add protection: **${config.protectBotAdds ? 'ON' : 'OFF'}**`,
              `Whitelist: ${config.whitelist.length ? config.whitelist.map((id) => `<@${id}>`).join(', ') : 'none (server owner is always trusted)'}`
            ].join('\n'),
            color: COLORS.danger
          })]
        });
      }

      if (subcommand === 'toggle') {
        const enabled = interaction.options.getBoolean('enabled', true);
        setAntiNuke(interaction.guild.id, { enabled });
        return interaction.reply({ ephemeral: true, content: `🚨 Anti-nuke is now **${enabled ? 'enabled' : 'disabled'}**.` });
      }

      if (subcommand === 'threshold') {
        const actions = interaction.options.getInteger('actions', true);
        const windowSeconds = interaction.options.getInteger('window_seconds');
        const patch = { threshold: actions };
        if (windowSeconds) patch.windowSeconds = windowSeconds;
        setAntiNuke(interaction.guild.id, patch);
        return interaction.reply({ ephemeral: true, content: `🚨 Anti-nuke will now trigger at **${actions}** actions per **${windowSeconds || antiNukeStatus(interaction.guild.id).windowSeconds}s**.` });
      }

      if (subcommand === 'punishment') {
        const type = interaction.options.getString('type', true);
        setAntiNuke(interaction.guild.id, { punishment: type });
        return interaction.reply({ ephemeral: true, content: `🚨 Anti-nuke punishment set to **${type}**.` });
      }

      if (subcommand === 'bot-protection') {
        const enabled = interaction.options.getBoolean('enabled', true);
        setAntiNuke(interaction.guild.id, { protectBotAdds: enabled });
        return interaction.reply({ ephemeral: true, content: `🚨 Bot-add protection is now **${enabled ? 'enabled' : 'disabled'}**.` });
      }

      if (subcommand === 'whitelist-add') {
        const user = interaction.options.getUser('user', true);
        addToWhitelist(interaction.guild.id, user.id);
        return interaction.reply({ ephemeral: true, content: `✅ <@${user.id}> is now whitelisted for anti-nuke.` });
      }

      if (subcommand === 'whitelist-remove') {
        const user = interaction.options.getUser('user', true);
        removeFromWhitelist(interaction.guild.id, user.id);
        return interaction.reply({ ephemeral: true, content: `✅ <@${user.id}> was removed from the anti-nuke whitelist.` });
      }

      return null;
    }

    if (subcommand === 'status') {
      const memory = getGuild(interaction.guild.id);
      return interaction.reply({
        ephemeral: true,
        embeds: [themedEmbed({
          title: '🛡️ Mort Security Status',
          description: [
            `Verification gate: **${memory.config?.verificationLocked !== false ? 'ON' : 'OFF'}**`,
            `Member role: ${memory.roles?.member ? `<@&${memory.roles.member}>` : 'missing'}`,
            `Verified role: ${memory.roles?.verified ? `<@&${memory.roles.verified}>` : 'missing'}`,
            `Unverified role: ${memory.roles?.unverified ? `<@&${memory.roles.unverified}>` : 'missing'}`,
            `Verify channel: ${memory.channels?.verify ? `<#${memory.channels.verify}>` : 'missing'}`,
            '',
            'Expected behavior: new people only see verify, then Mort gives Member + Verified and hides verify.',
            '',
            'Run `/security antinuke status` for anti-nuke details.'
          ].join('\n'),
          color: COLORS.lightBlue
        })]
      });
    }

    if (subcommand === 'refresh-perms') {
      await interaction.deferReply({ ephemeral: true });
      await setupServer(interaction.guild);
      return interaction.editReply({
        embeds: [themedEmbed({
          title: '✅ Permissions Refreshed',
          description: 'Mort re-applied the locked verification blueprint across roles, categories, and channels.',
          color: COLORS.success
        })]
      });
    }

    if (subcommand === 'verification') {
      const locked = interaction.options.getBoolean('locked', true);
      updateGuild(interaction.guild.id, (guild) => {
        guild.config.verificationLocked = locked;
      });
      if (locked) await setupServer(interaction.guild);
      return interaction.reply({ ephemeral: true, content: `✅ Verification gate is now **${locked ? 'ON' : 'OFF'}**.${locked ? ' Permissions were refreshed.' : ''}` });
    }

    return null;
  }
};
