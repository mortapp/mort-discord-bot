const { PermissionFlagsBits } = require('discord.js');

const COLORS = {
  voidBlack: 0x0b0b13,
  royalPurple: 0x7c3aed,
  lightBlue: 0x60a5fa,
  whiteGlow: 0xf8fafc,
  danger: 0xef4444,
  success: 0x22c55e,
  warning: 0xf59e0b,
  muted: 0x6b7280,
  pink: 0xec4899,
  gold: 0xfbbf24
};

const THEME = {
  botName: 'Mort',
  tagline: 'Clean server setup. Smooth support. Smart self-repair.',
  colors: COLORS,
  footer: 'Mort • black / purple / light blue / white',
  icons: {
    crown: '👑',
    shield: '🛡️',
    spark: '✦',
    ticket: '🎫',
    voice: '🔊',
    bot: '🤖',
    member: '🫧',
    warning: '⚠️',
    success: '✅',
    repair: '🧬'
  }
};

const ROLE_BLUEPRINT = [
  {
    key: 'owner',
    name: '👑 Owner',
    color: COLORS.royalPurple,
    hoist: true,
    mentionable: false,
    permissions: [PermissionFlagsBits.Administrator]
  },
  {
    key: 'admin',
    name: '🛡️ Admin',
    color: COLORS.royalPurple,
    hoist: true,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ViewAuditLog,
      PermissionFlagsBits.ManageWebhooks
    ]
  },
  {
    key: 'moderator',
    name: '🔨 Moderator',
    color: COLORS.lightBlue,
    hoist: true,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ViewAuditLog
    ]
  },
  {
    key: 'helper',
    name: '💠 Helper',
    color: COLORS.lightBlue,
    hoist: true,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ModerateMembers
    ]
  },
  {
    key: 'developer',
    name: '🧠 Developer',
    color: COLORS.whiteGlow,
    hoist: true,
    mentionable: true,
    permissions: []
  },
  {
    key: 'designer',
    name: '🎨 Designer',
    color: COLORS.pink,
    hoist: false,
    mentionable: true,
    permissions: []
  },
  {
    key: 'unverified',
    name: '🚪 Unverified',
    color: COLORS.muted,
    hoist: false,
    mentionable: false,
    permissions: []
  },
  {
    key: 'member',
    name: '🫧 Member',
    color: COLORS.whiteGlow,
    hoist: false,
    mentionable: true,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak
    ]
  },
  {
    key: 'verified',
    name: '✅ Verified',
    color: COLORS.success,
    hoist: false,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak
    ]
  },
  {
    key: 'vip',
    name: '💎 VIP',
    color: COLORS.royalPurple,
    hoist: false,
    mentionable: true,
    permissions: []
  },
  {
    key: 'booster',
    name: '🚀 Booster',
    color: COLORS.pink,
    hoist: false,
    mentionable: true,
    permissions: []
  },
  {
    key: 'betaTester',
    name: '🧪 Beta Tester',
    color: COLORS.gold,
    hoist: false,
    mentionable: true,
    permissions: []
  },
  {
    key: 'partner',
    name: '🤝 Partner',
    color: COLORS.lightBlue,
    hoist: false,
    mentionable: true,
    permissions: []
  },
  {
    key: 'bot',
    name: '🤖 Bot',
    color: COLORS.royalPurple,
    hoist: false,
    mentionable: false,
    permissions: []
  },
  {
    key: 'muted',
    name: '🔇 Muted',
    color: COLORS.muted,
    hoist: false,
    mentionable: false,
    permissions: []
  }
];

const CHANNEL_BLUEPRINT = [
  {
    key: 'start',
    name: 'MORT • START',
    type: 'category',
    access: 'member',
    channels: [
      { key: 'verify', name: '✅│verify', type: 'text', access: 'verify', topic: 'Only unverified people can see this. Press the Mort verify button to unlock the server.' },
      { key: 'welcome', name: '👋│welcome', type: 'text', access: 'readonly', topic: 'Welcome messages after members verify.' },
      { key: 'goodbye', name: '👋│goodbye', type: 'text', access: 'readonly', topic: 'Goodbye messages and member leave notices.' },
      { key: 'rules', name: '📜│rules', type: 'text', access: 'readonly', topic: 'Server rules, safety, and expectations.' },
      { key: 'announcements', name: '📢│announcements', type: 'text', access: 'readonly', topic: 'Official updates only.' },
      { key: 'serverMap', name: '🗺️│server-map', type: 'text', access: 'readonly', topic: 'Server layout and useful channels.' },
      { key: 'faq', name: '❔│faq', type: 'text', access: 'readonly', topic: 'Frequently asked questions for Mort.' },
      { key: 'resources', name: '📚│resources', type: 'text', access: 'readonly', topic: 'Useful links, app resources, and server help.' }
    ]
  },
  {
    key: 'community',
    name: 'MORT • COMMUNITY',
    type: 'category',
    access: 'member',
    channels: [
      { key: 'general', name: '💬│general', type: 'text', access: 'member', topic: 'Main chat.' },
      { key: 'media', name: '📸│media', type: 'text', access: 'member', topic: 'Images, edits, screenshots, and clips.' },
      { key: 'memes', name: '😭│memes', type: 'text', access: 'member', topic: 'Memes and jokes. Keep it clean.' },
      { key: 'introductions', name: '👋│introductions', type: 'text', access: 'member', topic: 'New verified members can introduce themselves.' },
      { key: 'polls', name: '📊│polls', type: 'text', access: 'member', topic: 'Polls and community votes.' },
      { key: 'suggestions', name: '💡│suggestions', type: 'text', access: 'member', topic: 'Community suggestions. Mort formats them cleanly.' },
      { key: 'commands', name: '🤖│bot-commands', type: 'text', access: 'member', topic: 'Use bot commands here.' }
    ]
  },
  {
    key: 'mortApp',
    name: 'MORT • APP',
    type: 'category',
    access: 'member',
    channels: [
      { key: 'appUpdates', name: '📱│app-updates', type: 'text', access: 'readonly', topic: 'Mort app updates and releases.' },
      { key: 'roadmap', name: '🧭│roadmap', type: 'text', access: 'readonly', topic: 'Roadmap, launch plans, and upcoming features.' },
      { key: 'bugReports', name: '🐞│bug-reports', type: 'text', access: 'member', topic: 'Report app or server bugs here.' },
      { key: 'featureIdeas', name: '💭│feature-ideas', type: 'text', access: 'member', topic: 'Ideas for the Mort app.' },
      { key: 'knownIssues', name: '🧯│known-issues', type: 'text', access: 'readonly', topic: 'Known bugs and current fixes.' },
      { key: 'changelog', name: '🧾│changelog', type: 'text', access: 'readonly', topic: 'Mort app changelog.' },
      { key: 'betaTesting', name: '🧪│beta-testing', type: 'text', access: 'beta', topic: 'Private beta testing chat.' },
      { key: 'betaVoice', name: '🧪│Beta Voice', type: 'voice', access: 'beta' }
    ]
  },
  {
    key: 'support',
    name: 'MORT • SUPPORT',
    type: 'category',
    access: 'member',
    channels: [
      { key: 'helpDesk', name: '💡│help-desk', type: 'text', access: 'member', topic: 'Ask for help or open a ticket.' },
      { key: 'ticketInfo', name: '🎫│tickets', type: 'text', access: 'member', topic: 'Open a private ticket with Mort.' },
      { key: 'reportsPublic', name: '🚨│report-a-user', type: 'text', access: 'member', topic: 'Use /community report. Reports are routed privately to staff.' },
      { key: 'appeals', name: '⚖️│appeals', type: 'text', access: 'member', topic: 'Appeal a moderation action through tickets.' },
      { key: 'safetyHelp', name: '🛟│safety-help', type: 'text', access: 'member', topic: 'Safety help and reporting instructions.' },
      { key: 'modLogs', name: '🧾│mod-logs', type: 'text', access: 'staff', topic: 'Private moderation and setup logs.' }
    ]
  },
  {
    key: 'voice',
    name: 'MORT • VOICE',
    type: 'category',
    access: 'member',
    channels: [
      { key: 'voiceLounge', name: '🔊│Lounge', type: 'voice', access: 'member' },
      { key: 'gamingVoice', name: '🎮│Gaming', type: 'voice', access: 'member' },
      { key: 'musicVoice', name: '🎵│Music', type: 'voice', access: 'member' },
      { key: 'createRoom', name: '➕│Create Room', type: 'voice', access: 'member', tempCreator: true },
      { key: 'afk', name: '💤│AFK', type: 'voice', access: 'member' }
    ]
  },
  {
    key: 'content',
    name: 'MORT • CONTENT',
    type: 'category',
    access: 'member',
    channels: [
      { key: 'clips', name: '🎬│clips', type: 'text', access: 'member', topic: 'Content drops and highlights.' },
      { key: 'creatorLounge', name: '🎥│creator-lounge', type: 'text', access: 'member', topic: 'Creators, edits, videos, and collaboration.' },
      { key: 'events', name: '⚡│events', type: 'text', access: 'readonly', topic: 'Server events and raids.' },
      { key: 'showcase', name: '🌟│showcase', type: 'text', access: 'member', topic: 'Show off wins, edits, builds, and progress.' },
      { key: 'collabs', name: '🤝│collabs', type: 'text', access: 'member', topic: 'Find people to collaborate with.' }
    ]
  },
  {
    key: 'premium',
    name: 'MORT • PRIVATE',
    type: 'category',
    access: 'member',
    channels: [
      { key: 'vipLounge', name: '💎│vip-lounge', type: 'text', access: 'vip', topic: 'VIP-only private lounge.' },
      { key: 'partnerChat', name: '🤝│partner-chat', type: 'text', access: 'partner', topic: 'Partner-only private chat.' },
      { key: 'privateRoomsInfo', name: '🔐│private-rooms', type: 'text', access: 'member', topic: 'Use /private create to make a temporary private room.' },
      { key: 'boosterLounge', name: '🚀│booster-lounge', type: 'text', access: 'vip', topic: 'Booster/VIP private lounge.' },
      { key: 'vipVoice', name: '💎│VIP Voice', type: 'voice', access: 'vip' }
    ]
  },
  {
    key: 'staff',
    name: 'MORT • STAFF',
    type: 'category',
    access: 'staff',
    channels: [
      { key: 'staffChat', name: '🛡️│staff-chat', type: 'text', access: 'staff', topic: 'Private staff chat.' },
      { key: 'reports', name: '🚨│reports', type: 'text', access: 'staff', topic: 'Reports and escalation queue.' },
      { key: 'joinLogs', name: '🚪│join-logs', type: 'text', access: 'staff', topic: 'Join, leave, and verification logs.' },
      { key: 'raidLogs', name: '🚨│raid-logs', type: 'text', access: 'staff', topic: 'Anti-raid and panic logs.' },
      { key: 'staffCommands', name: '⚙️│staff-commands', type: 'text', access: 'staff', topic: 'Staff-only command room.' },
      { key: 'adminChat', name: '👑│admin-chat', type: 'text', access: 'admin', topic: 'Owner/Admin private strategy channel.' },
      { key: 'adminVoice', name: '👑│Admin Room', type: 'voice', access: 'admin' }
    ]
  }
];

module.exports = {
  COLORS,
  THEME,
  ROLE_BLUEPRINT,
  CHANNEL_BLUEPRINT
};
