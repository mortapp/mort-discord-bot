const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');
const { requirePermission, assertSafeAssignableRole } = require('../utils/guards');
const { updateGuild } = require('../services/dataStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Create Mort button role panels.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) => sub
      .setName('button')
      .setDescription('Create a safe button that toggles a role.')
      .addRoleOption((opt) => opt.setName('role').setDescription('Safe, non-privileged role to toggle.').setRequired(true))
      .addStringOption((opt) => opt.setName('title').setDescription('Panel title.').setMaxLength(120).setRequired(true))
      .addStringOption((opt) => opt.setName('description').setDescription('Panel description.').setMaxLength(1200).setRequired(true))
      .addStringOption((opt) => opt.setName('label').setDescription('Button label.').setMaxLength(80).setRequired(false))
      .addStringOption((opt) => opt.setName('emoji').setDescription('Button emoji.').setMaxLength(20).setRequired(false))
      .addChannelOption((opt) => opt.setName('channel').setDescription('Where to send it.').addChannelTypes(ChannelType.GuildText).setRequired(false))),

  async execute(interaction) {
    requirePermission(interaction, PermissionFlagsBits.ManageRoles, 'Manage Roles');
    const role = interaction.options.getRole('role', true);
    assertSafeAssignableRole(interaction.guild, role);
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const label = interaction.options.getString('label') || `Toggle ${role.name}`;
    const emoji = interaction.options.getString('emoji') || '✨';
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    if (!channel?.send) throw new Error('Select a text channel for the role panel.');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rr:${role.id}`).setLabel(label).setEmoji(emoji).setStyle(ButtonStyle.Primary)
    );
    const panelMessage = await channel.send({
      allowedMentions: { parse: [] },
      embeds: [themedEmbed({ title, description: `${description}\n\nButton role: ${role}`, color: COLORS.royalPurple })],
      components: [row]
    });

    updateGuild(interaction.guild.id, (guild) => {
      guild.reactionRolePanels[panelMessage.id] = {
        roleId: role.id,
        channelId: channel.id,
        createdBy: interaction.user.id,
        createdAt: new Date().toISOString()
      };
    });
    return interaction.reply({ ephemeral: true, content: `✅ Safe reaction-role button sent to ${channel}. Mort will only honor this recorded panel.` });
  }
};
