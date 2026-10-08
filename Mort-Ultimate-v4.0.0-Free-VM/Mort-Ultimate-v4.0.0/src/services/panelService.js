const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { themedEmbed } = require('../utils/theme');
const { COLORS, THEME } = require('../config/blueprint');

function mainPanel() {
  const embed = themedEmbed({
    title: '✦ Mort Control Panel',
    description: [
      '**Welcome to the Mort system.**',
      'Use the buttons below to verify, open support, view the server map, or get help.',
      '',
      '`/setup repair` can rebuild missing server pieces without wiping your server.'
    ].join('\n'),
    color: COLORS.royalPurple,
    fields: [
      { name: 'Theme', value: 'Black • Purple • Light Blue • White', inline: true },
      { name: 'Systems', value: 'Tickets • Roles • Voice Rooms • Moderation', inline: true }
    ]
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mort:verify').setLabel('Verify').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('mort:ticket').setLabel('Open Ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('mort:map').setLabel('Server Map').setEmoji('🗺️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('mort:help').setLabel('Help').setEmoji('🤖').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

function verifyPanel() {
  const embed = themedEmbed({
    title: '✅ Verify With Mort',
    description: ['Press the button below to unlock the server.', '', '**What happens:**', '• Mort gives you `🫧 Member` + `✅ Verified`.', '• Mort removes `🚪 Unverified`.', '• This verify channel disappears after you verify.', '', '**Rules summary:** Be respectful, no scams, no spam, no harassment, keep it clean.'].join('\n'),
    color: COLORS.lightBlue
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mort:verify').setLabel('Verify Me').setEmoji('✅').setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}

function ticketPanel() {
  const embed = themedEmbed({
    title: '🎫 Mort Support Tickets',
    description: 'Need help? Open a private ticket. Staff will see it, regular members will not.',
    color: COLORS.royalPurple
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mort:ticket').setLabel('Open Ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

function ticketControls() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:claim').setLabel('Claim').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:unclaim').setLabel('Unclaim').setEmoji('🔓').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:close').setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
    )
  ];
}

function helpEmbed() {
  return themedEmbed({
    title: `${THEME.icons.bot} Mort Help`,
    description: [
      '**Core commands**',
      '`/setup preview` — see the full server blueprint',
      '`/setup server` — build the server',
      '`/setup repair` — recreate missing Mort pieces',
      '`/welcome status` — view welcome/goodbye settings',
      '`/security status` — view verification lock status',
      '`/verify panel` — send the verify gate panel',
      '`/community suggest` — send a suggestion',
      '`/community report` — privately report a user',
      '`/level rank` — see XP/rank',
      '`/reactionrole button` — create button roles',
      '`/private create` — create private text/voice rooms',
      '`/panel send` — send a control panel',
      '`/ticket open` — open support',
      '`/voice rename` — rename your temp voice room',
      '`/mort doctor` — diagnose setup issues',
      '',
      '**Tip:** Put the Mort bot role above the roles it creates/manages. Run `/security refresh-perms` after changing roles.'
    ].join('\n'),
    color: COLORS.lightBlue
  });
}

module.exports = {
  mainPanel,
  verifyPanel,
  ticketPanel,
  ticketControls,
  helpEmbed
};
