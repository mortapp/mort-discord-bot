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
const { requireManageGuild } = require('../utils/guards');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Create Mort button role panels.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) => sub
      .setName('button')
      .setDescription('Create a button that toggles a role.')
      .addRoleOption((opt) => opt.setName('role').setDescription('Role to toggle.').setRequired(true))
      .addStringOption((opt) => opt.setName('title').setDescription('Panel title.').setMaxLength(120).setRequired(true))
      .addStringOption((opt) => opt.setName('description').setDescription('Panel description.').setMaxLength(1200).setRequired(true))
      .addStringOption((opt) => opt.setName('label').setDescription('Button label.').setMaxLength(80).setRequired(false))
      .addStringOption((opt) => opt.setName('emoji').setDescription('Button emoji.').setMaxLength(20).setRequired(false))
      .addChannelOption((opt) => opt.setName('channel').setDescription('Where to send it.').addChannelTypes(ChannelType.GuildText).setRequired(false))),

  async execute(interaction) {
    requireManageGuild(interaction);
    const role = interaction.options.getRole('role', true);
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const label = interaction.options.getString('label') || `Toggle ${role.name}`;
    const emoji = interaction.options.getString('emoji') || '✨';
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rr:${role.id}`)
        .setLabel(label)
        .setEmoji(emoji)
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({
      embeds: [themedEmbed({
        title,
        description: `${description}\n\nButton role: ${role}`,
        color: COLORS.royalPurple
      })],
      components: [row]
    });

    return interaction.reply({ ephemeral: true, content: `✅ Reaction-role button sent to ${channel}.` });
  }
};
