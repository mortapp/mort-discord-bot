const {
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');
const { ROLE_BLUEPRINT, CHANNEL_BLUEPRINT, COLORS } = require('../config/blueprint');
const { themedEmbed, listLines } = require('../utils/theme');
const { updateGuild, getGuild, logRepair } = require('./dataStore');
const { mainPanel, verifyPanel, ticketPanel } = require('./panelService');

function rolePermissions(roleBlueprint) {
  return roleBlueprint.permissions || [];
}

function canReadChannel(channel) {
  return channel?.isTextBased?.() && channel.viewable;
}

function roleList(roles, keys) {
  return keys.map((key) => roles[key]).filter(Boolean);
}

function basicMemberAllows(channelType = 'text') {
  const allow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory
  ];
  if (channelType === 'voice') {
    allow.push(PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.UseVAD);
  } else {
    allow.push(
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles
    );
  }
  return allow;
}

function staffAllows(channelType = 'text') {
  const allow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.ManageMessages
  ];
  if (channelType === 'voice') {
    allow.push(PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.MoveMembers);
  } else {
    allow.push(PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageThreads);
  }
  return allow;
}

function pushAllow(overwrites, role, allow, deny = []) {
  if (!role) return;
  overwrites.push({ id: role.id, allow, deny });
}

function createOverwrites(guild, roles, access = 'member', channelType = 'text') {
  const overwrites = [];
  const everyone = guild.roles.everyone.id;
  const memberAllows = basicMemberAllows(channelType);
  const readOnlyAllows = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];
  const staffRoleObjects = roleList(roles, ['owner', 'admin', 'moderator', 'helper']);
  const adminRoleObjects = roleList(roles, ['owner', 'admin']);

  const denyUnverified = [PermissionFlagsBits.ViewChannel];
  const mutedDeny = channelType === 'voice'
    ? [PermissionFlagsBits.Speak]
    : [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads];

  if (access === 'verify') {
    overwrites.push({
      id: everyone,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
      deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions, PermissionFlagsBits.CreatePublicThreads]
    });
    pushAllow(overwrites, roles.unverified, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], [PermissionFlagsBits.SendMessages]);
    pushAllow(overwrites, roles.member, [], [PermissionFlagsBits.ViewChannel]);
    pushAllow(overwrites, roles.verified, [], [PermissionFlagsBits.ViewChannel]);
    staffRoleObjects.forEach((role) => pushAllow(overwrites, role, staffAllows('text')));
    return overwrites;
  }

  overwrites.push({ id: everyone, deny: [PermissionFlagsBits.ViewChannel] });
  pushAllow(overwrites, roles.unverified, [], denyUnverified);

  if (access === 'staff') {
    staffRoleObjects.forEach((role) => pushAllow(overwrites, role, staffAllows(channelType)));
  } else if (access === 'admin') {
    adminRoleObjects.forEach((role) => pushAllow(overwrites, role, staffAllows(channelType)));
  } else if (access === 'vip') {
    pushAllow(overwrites, roles.vip, memberAllows);
    staffRoleObjects.forEach((role) => pushAllow(overwrites, role, staffAllows(channelType)));
  } else if (access === 'partner') {
    pushAllow(overwrites, roles.partner, memberAllows);
    staffRoleObjects.forEach((role) => pushAllow(overwrites, role, staffAllows(channelType)));
  } else if (access === 'beta') {
    pushAllow(overwrites, roles.betaTester, memberAllows);
    staffRoleObjects.forEach((role) => pushAllow(overwrites, role, staffAllows(channelType)));
  } else if (access === 'readonly') {
    pushAllow(overwrites, roles.member, readOnlyAllows, channelType === 'voice' ? [] : [PermissionFlagsBits.SendMessages]);
    pushAllow(overwrites, roles.verified, readOnlyAllows, channelType === 'voice' ? [] : [PermissionFlagsBits.SendMessages]);
    staffRoleObjects.forEach((role) => pushAllow(overwrites, role, staffAllows(channelType)));
  } else {
    pushAllow(overwrites, roles.member, memberAllows);
    pushAllow(overwrites, roles.verified, memberAllows);
    staffRoleObjects.forEach((role) => pushAllow(overwrites, role, staffAllows(channelType)));
  }

  if (roles.muted) overwrites.push({ id: roles.muted.id, deny: mutedDeny });
  return overwrites;
}

async function applyOverwrites(target, overwrites) {
  if (!target?.permissionOverwrites?.set) return;
  await target.permissionOverwrites.set(overwrites, 'Mort permission blueprint').catch(() => null);
}

async function findOrCreateRole(guild, roleBlueprint) {
  const existing = guild.roles.cache.find((role) => role.name === roleBlueprint.name);
  if (existing) return { role: existing, created: false };

  const role = await guild.roles.create({
    name: roleBlueprint.name,
    color: roleBlueprint.color,
    hoist: roleBlueprint.hoist,
    mentionable: roleBlueprint.mentionable,
    permissions: rolePermissions(roleBlueprint),
    reason: 'Mort server setup role blueprint'
  });
  return { role, created: true };
}

async function findOrCreateCategory(guild, categoryBlueprint, roles) {
  const existing = guild.channels.cache.find((channel) => channel.name === categoryBlueprint.name && channel.type === ChannelType.GuildCategory);
  const overwrites = createOverwrites(guild, roles, categoryBlueprint.access || 'member', 'text');
  if (existing) {
    await applyOverwrites(existing, overwrites);
    return { category: existing, created: false };
  }

  const category = await guild.channels.create({
    name: categoryBlueprint.name,
    type: ChannelType.GuildCategory,
    permissionOverwrites: overwrites,
    reason: 'Mort server setup category blueprint'
  });
  return { category, created: true };
}

async function findOrCreateChannel(guild, channelBlueprint, parent, roles) {
  const channelType = channelBlueprint.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
  const access = channelBlueprint.access || 'member';
  const existing = guild.channels.cache.find((channel) => channel.name === channelBlueprint.name && channel.parentId === parent.id && channel.type === channelType);
  const overwrites = createOverwrites(guild, roles, access, channelBlueprint.type);

  if (existing) {
    await applyOverwrites(existing, overwrites);
    if (channelBlueprint.topic && existing.isTextBased?.()) await existing.setTopic(channelBlueprint.topic).catch(() => null);
    return { channel: existing, created: false };
  }

  const channel = await guild.channels.create({
    name: channelBlueprint.name,
    type: channelType,
    parent: parent.id,
    topic: channelBlueprint.type === 'text' ? channelBlueprint.topic : undefined,
    permissionOverwrites: overwrites,
    userLimit: channelBlueprint.tempCreator ? 1 : undefined,
    reason: 'Mort server setup channel blueprint'
  });
  return { channel, created: true };
}

async function sendIfEmpty(channel, payload) {
  if (!canReadChannel(channel)) return false;
  const messages = await channel.messages.fetch({ limit: 1 }).catch(() => null);
  if (messages && messages.size > 0) return false;
  await channel.send(payload).catch(() => null);
  return true;
}

async function seedChannels(guild, memory) {
  const welcome = await guild.channels.fetch(memory.channels.welcome).catch(() => null);
  const rules = await guild.channels.fetch(memory.channels.rules).catch(() => null);
  const verify = await guild.channels.fetch(memory.channels.verify).catch(() => null);
  const ticketInfo = await guild.channels.fetch(memory.channels.ticketInfo).catch(() => null);
  const serverMap = await guild.channels.fetch(memory.channels.serverMap).catch(() => null);
  const announcements = await guild.channels.fetch(memory.channels.announcements).catch(() => null);
  const suggestions = await guild.channels.fetch(memory.channels.suggestions).catch(() => null);
  const privateRoomsInfo = await guild.channels.fetch(memory.channels.privateRoomsInfo).catch(() => null);

  if (verify) {
    await sendIfEmpty(verify, verifyPanel());
  }

  if (welcome) {
    await sendIfEmpty(welcome, mainPanel());
  }

  if (rules) {
    await sendIfEmpty(rules, {
      embeds: [themedEmbed({
        title: '📜 Mort Rules',
        description: [
          '1. Respect everyone. No harassment, racism, threats, doxxing, or sexual content involving minors.',
          '2. No scams, token grabbers, fake Nitro links, phishing, or malicious downloads.',
          '3. Keep channels on topic. Use tickets for private support.',
          '4. No spam, raids, NSFW, hate speech, or illegal content.',
          '5. Staff decisions are final. Open a ticket if you need help.'
        ].join('\n'),
        color: COLORS.royalPurple
      })]
    });
  }

  if (ticketInfo) {
    await sendIfEmpty(ticketInfo, ticketPanel());
  }

  if (serverMap) {
    const categoryLines = CHANNEL_BLUEPRINT.map((category) => `**${category.name}**\n${category.channels.map((ch) => `↳ ${ch.name}`).join('\n')}`);
    await sendIfEmpty(serverMap, {
      embeds: [themedEmbed({
        title: '🗺️ Mort Server Map',
        description: categoryLines.join('\n\n').slice(0, 3900),
        color: COLORS.lightBlue
      })]
    });
  }

  if (announcements) {
    await sendIfEmpty(announcements, {
      embeds: [themedEmbed({
        title: '📢 Mort Announcement Channel Ready',
        description: 'This channel is ready for official updates, drops, and server news.',
        color: COLORS.royalPurple
      })]
    });
  }

  if (suggestions) {
    await sendIfEmpty(suggestions, {
      embeds: [themedEmbed({
        title: '💡 Suggestions',
        description: 'Use `/community suggest` and Mort will post a clean suggestion card with voting buttons.',
        color: COLORS.lightBlue
      })]
    });
  }

  if (privateRoomsInfo) {
    await sendIfEmpty(privateRoomsInfo, {
      embeds: [themedEmbed({
        title: '🔐 Private Rooms',
        description: 'Use `/private create` to make a temporary private text or voice room for selected members.',
        color: COLORS.royalPurple
      })]
    });
  }
}

async function setupServer(guild) {
  const created = { roles: [], categories: [], channels: [] };
  const roleObjects = {};

  for (const roleBlueprint of ROLE_BLUEPRINT) {
    const { role, created: roleCreated } = await findOrCreateRole(guild, roleBlueprint);
    roleObjects[roleBlueprint.key] = role;
    if (roleCreated) created.roles.push(role.name);
  }

  const categories = {};
  const channels = {};

  for (const categoryBlueprint of CHANNEL_BLUEPRINT) {
    const { category, created: categoryCreated } = await findOrCreateCategory(guild, categoryBlueprint, roleObjects);
    categories[categoryBlueprint.key] = category.id;
    if (categoryCreated) created.categories.push(category.name);

    for (const channelBlueprint of categoryBlueprint.channels) {
      const { channel, created: channelCreated } = await findOrCreateChannel(guild, channelBlueprint, category, roleObjects);
      channels[channelBlueprint.key] = channel.id;
      if (channelCreated) created.channels.push(channel.name);
    }
  }

  await guild.setAFKChannel(channels.afk).catch(() => null);

  const memory = updateGuild(guild.id, (guildMemory) => {
    guildMemory.roles = Object.fromEntries(Object.entries(roleObjects).map(([key, role]) => [key, role.id]));
    guildMemory.categories = categories;
    guildMemory.channels = channels;
    guildMemory.config = {
      ...guildMemory.config,
      theme: 'black-purple-lightblue-white',
      setupAt: new Date().toISOString(),
      verificationLocked: true,
      tempVoiceLobbyId: channels.createRoom,
      ticketCategoryId: categories.support,
      privateCategoryId: categories.premium,
      logChannelId: channels.modLogs,
      verifiedRoleId: roleObjects.verified?.id,
      memberRoleId: roleObjects.member?.id,
      unverifiedRoleId: roleObjects.unverified?.id,
      autoRoleId: roleObjects.unverified?.id,
      autoRoleEnabled: true,
      welcomeEnabled: guildMemory.config?.welcomeEnabled ?? true,
      goodbyeEnabled: guildMemory.config?.goodbyeEnabled ?? true,
      welcomeChannelId: guildMemory.config?.welcomeChannelId || channels.welcome,
      goodbyeChannelId: guildMemory.config?.goodbyeChannelId || channels.goodbye || channels.welcome,
      xpEnabled: guildMemory.config?.xpEnabled ?? true,
      automod: {
        antiInvite: true,
        maxMentions: 6,
        ...(guildMemory.config?.automod || {})
      }
    };
  });

  await seedChannels(guild, memory);

  logRepair(guild.id, {
    type: 'setup',
    created
  });

  return { memory, created };
}

async function diagnose(guild) {
  const memory = getGuild(guild.id);
  const missing = { roles: [], categories: [], channels: [] };

  for (const roleBlueprint of ROLE_BLUEPRINT) {
    const id = memory.roles?.[roleBlueprint.key];
    const existsById = id ? await guild.roles.fetch(id).catch(() => null) : null;
    const existsByName = guild.roles.cache.find((role) => role.name === roleBlueprint.name);
    if (!existsById && !existsByName) missing.roles.push(roleBlueprint.name);
  }

  for (const categoryBlueprint of CHANNEL_BLUEPRINT) {
    const id = memory.categories?.[categoryBlueprint.key];
    const existsById = id ? await guild.channels.fetch(id).catch(() => null) : null;
    const existsByName = guild.channels.cache.find((channel) => channel.name === categoryBlueprint.name && channel.type === ChannelType.GuildCategory);
    if (!existsById && !existsByName) missing.categories.push(categoryBlueprint.name);

    for (const channelBlueprint of categoryBlueprint.channels) {
      const chId = memory.channels?.[channelBlueprint.key];
      const type = channelBlueprint.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
      const chById = chId ? await guild.channels.fetch(chId).catch(() => null) : null;
      const chByName = guild.channels.cache.find((channel) => channel.name === channelBlueprint.name && channel.type === type);
      if (!chById && !chByName) missing.channels.push(channelBlueprint.name);
    }
  }

  const healthy = missing.roles.length === 0 && missing.categories.length === 0 && missing.channels.length === 0;
  return { healthy, missing, memory };
}

function previewText() {
  return [
    '**Roles**',
    listLines(ROLE_BLUEPRINT.map((role) => role.name)),
    '',
    '**Verification Lock**',
    'Unverified users only see `✅│verify`. After pressing Verify, Mort gives `🫧 Member` + `✅ Verified`, removes `🚪 Unverified`, and hides the verify channel.',
    '',
    '**Categories / Channels**',
    CHANNEL_BLUEPRINT.map((category) => `${category.name}\n${category.channels.map((ch) => `  ↳ ${ch.name}`).join('\n')}`).join('\n\n')
  ].join('\n');
}

module.exports = {
  setupServer,
  diagnose,
  previewText,
  createOverwrites
};
