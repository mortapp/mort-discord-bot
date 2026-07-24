const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const { getGuild } = require('../services/dataStore');
const {
  DEFAULT_WELCOME_MESSAGE,
  DEFAULT_GOODBYE_MESSAGE,
  setWelcomeConfig,
  statusText,
  testWelcome,
  sendConfiguredPreview
} = require('../services/welcomeService');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { requireManageGuild } = require('../utils/guards');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure Mort welcome, goodbye, and auto-role systems.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('status')
      .setDescription('Show Mort welcome/goodbye settings.'))
    .addSubcommand((sub) => sub
      .setName('channel')
      .setDescription('Set the welcome or goodbye channel.')
      .addStringOption((opt) => opt
        .setName('type')
        .setDescription('Which channel are you setting?')
        .setRequired(true)
        .addChoices(
          { name: 'Welcome', value: 'welcome' },
          { name: 'Goodbye', value: 'goodbye' }
        ))
      .addChannelOption((opt) => opt
        .setName('channel')
        .setDescription('Text channel where Mort should send messages.')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('toggle')
      .setDescription('Turn welcome or goodbye messages on/off.')
      .addStringOption((opt) => opt
        .setName('system')
        .setDescription('System to toggle.')
        .setRequired(true)
        .addChoices(
          { name: 'Welcome messages', value: 'welcome' },
          { name: 'Goodbye messages', value: 'goodbye' },
          { name: 'Auto-role on join', value: 'autorole' }
        ))
      .addBooleanOption((opt) => opt
        .setName('enabled')
        .setDescription('On or off?')
        .setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('autorole')
      .setDescription('Set the pre-verification role Mort gives new members when they join.')
      .addRoleOption((opt) => opt
        .setName('role')
        .setDescription('Usually 🚪 Unverified. Member is given only after Verify.')
        .setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('message')
      .setDescription('Customize the welcome or goodbye message text.')
      .addStringOption((opt) => opt
        .setName('type')
        .setDescription('Which message are you editing?')
        .setRequired(true)
        .addChoices(
          { name: 'Welcome', value: 'welcome' },
          { name: 'Goodbye', value: 'goodbye' }
        ))
      .addStringOption((opt) => opt
        .setName('text')
        .setDescription('Use placeholders like {user}, {server}, {memberCount}, {rules}, {verify}.')
        .setMaxLength(1000)
        .setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('reset-message')
      .setDescription('Reset the welcome or goodbye message to Mort default.')
      .addStringOption((opt) => opt
        .setName('type')
        .setDescription('Which message should reset?')
        .setRequired(true)
        .addChoices(
          { name: 'Welcome', value: 'welcome' },
          { name: 'Goodbye', value: 'goodbye' }
        )))
    .addSubcommand((sub) => sub
      .setName('test')
      .setDescription('Preview a welcome or goodbye embed privately.')
      .addStringOption((opt) => opt
        .setName('type')
        .setDescription('Preview welcome or goodbye?')
        .setRequired(true)
        .addChoices(
          { name: 'Welcome', value: 'welcome' },
          { name: 'Goodbye', value: 'goodbye' }
        ))
      .addUserOption((opt) => opt
        .setName('user')
        .setDescription('Optional member to preview with.')
        .setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('send-test')
      .setDescription('Send a real preview into the configured welcome/goodbye channel.')
      .addStringOption((opt) => opt
        .setName('type')
        .setDescription('Send welcome or goodbye preview?')
        .setRequired(true)
        .addChoices(
          { name: 'Welcome', value: 'welcome' },
          { name: 'Goodbye', value: 'goodbye' }
        ))),

  async execute(interaction) {
    requireManageGuild(interaction);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'status') {
      const memory = getGuild(interaction.guild.id);
      return interaction.reply({
        ephemeral: true,
        embeds: [themedEmbed({
          title: '👋 Mort Welcome System',
          description: statusText(memory),
          color: COLORS.lightBlue
        })]
      });
    }

    if (subcommand === 'channel') {
      const type = interaction.options.getString('type', true);
      const channel = interaction.options.getChannel('channel', true);
      const patch = type === 'welcome'
        ? { welcomeChannelId: channel.id }
        : { goodbyeChannelId: channel.id };
      setWelcomeConfig(interaction.guild.id, patch);
      return interaction.reply({
        ephemeral: true,
        embeds: [themedEmbed({
          title: '✅ Channel Saved',
          description: `Mort ${type} messages will now go to ${channel}.`,
          color: COLORS.success
        })]
      });
    }

    if (subcommand === 'toggle') {
      const system = interaction.options.getString('system', true);
      const enabled = interaction.options.getBoolean('enabled', true);
      const keys = {
        welcome: 'welcomeEnabled',
        goodbye: 'goodbyeEnabled',
        autorole: 'autoRoleEnabled'
      };
      setWelcomeConfig(interaction.guild.id, { [keys[system]]: enabled });
      return interaction.reply({ ephemeral: true, content: `✅ Mort ${system} is now **${enabled ? 'ON' : 'OFF'}**.` });
    }

    if (subcommand === 'autorole') {
      const role = interaction.options.getRole('role', true);
      setWelcomeConfig(interaction.guild.id, { autoRoleId: role.id, autoRoleEnabled: true, unverifiedRoleId: role.id });
      return interaction.reply({ ephemeral: true, content: `✅ New members will receive ${role} when they join. Mort still gives Member + Verified only after they press Verify.` });
    }

    if (subcommand === 'message') {
      const type = interaction.options.getString('type', true);
      const text = interaction.options.getString('text', true);
      setWelcomeConfig(interaction.guild.id, type === 'welcome' ? { welcomeMessage: text } : { goodbyeMessage: text });
      return interaction.reply({
        ephemeral: true,
        embeds: [themedEmbed({
          title: '✅ Message Saved',
          description: `Mort ${type} message updated. Run \`/welcome test type:${type}\` to preview it.`,
          color: COLORS.success
        })]
      });
    }

    if (subcommand === 'reset-message') {
      const type = interaction.options.getString('type', true);
      setWelcomeConfig(interaction.guild.id, type === 'welcome'
        ? { welcomeMessage: DEFAULT_WELCOME_MESSAGE }
        : { goodbyeMessage: DEFAULT_GOODBYE_MESSAGE });
      return interaction.reply({ ephemeral: true, content: `✅ Mort ${type} message reset to default.` });
    }

    if (subcommand === 'test') {
      const type = interaction.options.getString('type', true);
      const user = interaction.options.getUser('user');
      return testWelcome(interaction, type, user);
    }

    if (subcommand === 'send-test') {
      const type = interaction.options.getString('type', true);
      return sendConfiguredPreview(interaction, type);
    }

    return null;
  }
};
