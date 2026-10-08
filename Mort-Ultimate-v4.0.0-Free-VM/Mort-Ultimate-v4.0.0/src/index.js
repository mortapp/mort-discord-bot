require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client, Collection, Events, GatewayIntentBits, ActivityType } = require('discord.js');
const { logError, getGuild, updateGuild } = require('./services/dataStore');
const { themedEmbed } = require('./utils/theme');
const { COLORS, CHANNEL_BLUEPRINT } = require('./config/blueprint');
const { openTicket, claimTicket, unclaimTicket, closeTicket } = require('./services/ticketService');
const { helpEmbed } = require('./services/panelService');
const { handleVoiceStateUpdate } = require('./services/voiceService');
const { handleMessageCreate, stopAutomodSweep } = require('./services/automodService');
const { handleEngagementMessage } = require('./services/engagementService');
const { handleGuildMemberAdd, handleGuildMemberRemove, sendVerifiedWelcome } = require('./services/welcomeService');
const { handleRaidJoin, stopRaidTimers } = require('./services/raidService');
const { handleReactionAdd } = require('./services/starboardService');
const { handleAuditLogEntry, stopAntiNukeTracking } = require('./services/antinukeService');
const { startHealthServer } = require('./services/healthServer');
const { handleMentionQuestion } = require('./services/assistantService');
const { diagnosePermissions, permissionFixText, missingPermissionMessage, canManageRole } = require('./services/permissionService');
const { assertSafeAssignableRole } = require('./utils/guards');
const { registerCommands } = require('./register-commands');
const { stopCooldownSweep } = require('./utils/cooldown');
const { restoreReminderScheduler, stopReminderScheduler } = require('./services/reminderService');
const { validateStartupConfig } = require('./config/runtime');

let client = null;
let healthServer = null;
let shuttingDown = false;
let shutdownPromise = null;
let fatalSeen = false;

function persistError(error, context) {
  console.error(`[Mort] ${context.event}:`, error?.stack || error);
  try { logError(error instanceof Error ? error : new Error(String(error)), context); } catch (loggingError) { /* Disk failure must not block safe shutdown. */ }
}

async function closeHealthServer() {
  if (!healthServer) return;
  healthServer.closeActiveConnections?.();
  await Promise.race([
    new Promise((resolve) => healthServer.close(() => resolve())),
    new Promise((resolve) => setTimeout(resolve, 5_000).unref?.())
  ]).catch(() => null);
}

async function shutdown(signal, exitCode = 0) {
  if (shutdownPromise) return shutdownPromise;
  shuttingDown = true;
  shutdownPromise = (async () => {
    console.log(`[Mort] ${signal} received. Shutting down cleanly...`);
    try { stopCooldownSweep(); } catch (error) { /* ignore */ }
    try { stopAutomodSweep(); } catch (error) { /* ignore */ }
    try { stopRaidTimers(); } catch (error) { /* ignore */ }
    try { stopAntiNukeTracking(); } catch (error) { /* ignore */ }
    try { stopReminderScheduler(); } catch (error) { /* ignore */ }
    await closeHealthServer();
    try { client?.destroy(); } catch (error) { console.error('[Mort] Discord client destroy failed:', error); }
    process.exit(exitCode);
  })();
  return shutdownPromise;
}

function fatal(error, event) {
  if (fatalSeen) return;
  fatalSeen = true;
  persistError(error, { event });
  void shutdown(`fatal:${event}`, 1).catch(() => process.exit(1));
  setTimeout(() => process.exit(1), 10_000).unref?.();
}

process.on('unhandledRejection', (reason) => fatal(reason instanceof Error ? reason : new Error(String(reason)), 'unhandledRejection'));
process.on('uncaughtException', (error) => fatal(error, 'uncaughtException'));

let runtime;
try {
  const startup = validateStartupConfig();
  if (startup.failures.length) throw new Error(startup.failures.join(' '));
  runtime = startup.config;
} catch (error) {
  console.error(`[Mort] Startup configuration error: ${error.message}`);
  process.exit(1);
}

client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration
  ]
});

healthServer = startHealthServer(client, {
  isShuttingDown: () => shuttingDown,
  onError: (error) => fatal(error, 'healthServer')
});

client.commands = new Collection();
function loadCommands(directory) {
  for (const file of fs.readdirSync(directory)) {
    const filePath = path.join(directory, file);
    if (fs.statSync(filePath).isDirectory()) {
      loadCommands(filePath);
    } else if (file.endsWith('.js')) {
      const command = require(filePath);
      if (!command?.data?.name || !command?.execute) continue;
      if (client.commands.has(command.data.name)) throw new Error(`Duplicate loaded command name: ${command.data.name}`);
      client.commands.set(command.data.name, command);
    }
  }
}

try {
  loadCommands(path.join(__dirname, 'commands'));
} catch (error) {
  fatal(error, 'commandLoad');
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log('════════════════════════════════════════');
  console.log(`Mort v${runtime.version} starting on Node ${process.version}`);
  console.log(`Commands loaded: ${client.commands.size}`);
  console.log(`Guilds connected: ${readyClient.guilds.cache.size}`);
  console.log(`Mort is online as ${readyClient.user.tag}`);
  console.log('════════════════════════════════════════');
  readyClient.user.setPresence({ activities: [{ name: `Mort v${runtime.version} • @Mort ask me ✦`, type: ActivityType.Watching }], status: 'online' });

  const restored = restoreReminderScheduler(readyClient);
  if (restored) console.log(`[Mort] Restored ${restored} persistent reminder(s).`);
  if (runtime.autoRegisterCommands) {
    registerCommands({ exitOnError: false }).catch((error) => persistError(error, { event: 'autoRegisterCommands' }));
  }
});

client.on('error', (error) => fatal(error, 'clientError'));
client.on('invalidated', () => fatal(new Error('Discord gateway session invalidated.'), 'gatewayInvalidated'));
client.on('shardError', (error, shardId) => persistError(error, { event: 'shardError', shardId }));
client.on('shardDisconnect', (event, shardId) => console.warn(`[Mort] Gateway shard ${shardId} disconnected (${event?.code || 'unknown'}).`));

client.on(Events.GuildMemberAdd, async (member) => {
  try { await handleGuildMemberAdd(member); await handleRaidJoin(member); }
  catch (error) { persistError(error, { event: 'guildMemberAdd', guildId: member.guild?.id, userId: member.id }); }
});
client.on(Events.GuildMemberRemove, async (member) => {
  try { await handleGuildMemberRemove(member); }
  catch (error) { persistError(error, { event: 'guildMemberRemove', guildId: member.guild?.id, userId: member.id }); }
});
client.on(Events.ChannelDelete, async (channel) => {
  if (!channel.guild) return;
  try {
    updateGuild(channel.guild.id, (memory) => {
      delete memory.tickets?.[channel.id];
      delete memory.tempVoiceRooms?.[channel.id];
      delete memory.privateRooms?.[channel.id];
      delete memory.channelLocks?.[channel.id];
      for (const [messageId, panel] of Object.entries(memory.reactionRolePanels || {})) {
        if (panel.channelId === channel.id) delete memory.reactionRolePanels[messageId];
      }
    });
  } catch (error) { persistError(error, { event: 'channelDelete', guildId: channel.guild?.id, channelId: channel.id }); }
});
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try { await handleVoiceStateUpdate(oldState, newState); }
  catch (error) { persistError(error, { event: 'voiceStateUpdate', guildId: newState.guild?.id || oldState.guild?.id }); }
});
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  try { await handleReactionAdd(reaction, user); }
  catch (error) { persistError(error, { event: 'messageReactionAdd', guildId: reaction.message?.guild?.id }); }
});
client.on(Events.MessageCreate, async (message) => {
  try {
    if (await handleMentionQuestion(message)) return;
    await handleMessageCreate(message);
    await handleEngagementMessage(message);
  } catch (error) { persistError(error, { event: 'messageCreate', guildId: message.guild?.id, channelId: message.channel?.id }); }
});
client.on(Events.GuildAuditLogEntryCreate, async (auditLogEntry, guild) => {
  try { await handleAuditLogEntry(auditLogEntry, guild); }
  catch (error) { persistError(error, { event: 'guildAuditLogEntryCreate', guildId: guild?.id }); }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if ((interaction.isChatInputCommand() || interaction.isButton()) && !interaction.inGuild()) {
      return interaction.reply({ ephemeral: true, content: 'Mort commands and panels can only be used inside a Discord server.' });
    }
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return interaction.reply({ ephemeral: true, content: 'This Mort command is not available in the current release.' });
      return command.execute(interaction, client);
    }
    if (!interaction.isButton()) return;

    const memory = getGuild(interaction.guild.id);
    if (interaction.customId === 'mort:verify') {
      const verifyChannelId = memory.config?.verifyChannelId || memory.channels?.verify;
      if (memory.config?.verificationLocked === false) return interaction.reply({ ephemeral: true, content: 'The verification gate is currently disabled by the server owner.' });
      if (!verifyChannelId || interaction.channelId !== verifyChannelId) return interaction.reply({ ephemeral: true, content: 'This verification button is not in Mort’s configured verify channel. Ask staff to run `/verify reset`.' });
      const verifiedRoleId = memory.config?.verifiedRoleId || memory.roles?.verified;
      const memberRoleId = memory.config?.memberRoleId || memory.roles?.member;
      const unverifiedRoleId = memory.config?.unverifiedRoleId || memory.roles?.unverified;
      if (!verifiedRoleId || !memberRoleId) return interaction.reply({ ephemeral: true, content: 'Mort cannot find the Member/Verified roles. Run `/setup repair` or `/verify repair`.' });
      const [verifiedRole, memberRole, unverifiedRole, member] = await Promise.all([
        interaction.guild.roles.fetch(verifiedRoleId).catch(() => null),
        interaction.guild.roles.fetch(memberRoleId).catch(() => null),
        unverifiedRoleId ? interaction.guild.roles.fetch(unverifiedRoleId).catch(() => null) : null,
        interaction.guild.members.fetch(interaction.user.id).catch(() => null)
      ]);
      if (!member || !verifiedRole || !memberRole) return interaction.reply({ ephemeral: true, content: 'The Member or Verified role is missing. Run `/setup repair` or `/verify repair`.' });
      if (member.roles.cache.has(verifiedRole.id) && member.roles.cache.has(memberRole.id)) return interaction.reply({ ephemeral: true, content: 'You are already verified.' });
      if (unverifiedRole && !member.roles.cache.has(unverifiedRole.id)) return interaction.reply({ ephemeral: true, content: 'You are not currently eligible for this verification panel. Ask staff for help.' });
      const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
      const blockedRoles = [verifiedRole, memberRole, unverifiedRole].filter(Boolean).filter((role) => !canManageRole(botMember, role));
      if (blockedRoles.length) {
        const report = await diagnosePermissions(interaction.guild);
        return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '⚠️ Mort Needs Role Permission', description: `${permissionFixText(report)}\n\nI need to manage: **${blockedRoles.map((role) => role.name).join(', ')}**.`, color: COLORS.warning })] });
      }
      await member.roles.add([verifiedRole, memberRole], 'Mort verify button');
      if (unverifiedRole) await member.roles.remove(unverifiedRole, 'Mort verified member').catch(() => null);
      await sendVerifiedWelcome(member).catch(() => null);
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '✅ Verified', description: 'You now have **Member** + **Verified**. The server is unlocked, and the verify channel is hidden from you now.', color: COLORS.success })] });
    }

    if (interaction.customId.startsWith('rr:')) {
      const roleId = interaction.customId.slice(3);
      const panel = memory.reactionRolePanels?.[interaction.message?.id];
      if (!panel || panel.roleId !== roleId || panel.channelId !== interaction.channelId) return interaction.reply({ ephemeral: true, content: 'This is not an active Mort reaction-role panel.' });
      const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
      if (!role) return interaction.reply({ ephemeral: true, content: 'That reaction role no longer exists.' });
      assertSafeAssignableRole(interaction.guild, role);
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role, 'Mort reaction role toggle');
        return interaction.reply({ ephemeral: true, content: `Removed ${role}.` });
      }
      await member.roles.add(role, 'Mort reaction role toggle');
      return interaction.reply({ ephemeral: true, content: `Added ${role}.` });
    }

    if (interaction.customId === 'mort:ticket') return openTicket(interaction, 'Opened from Mort panel.');
    if (interaction.customId === 'mort:map') {
      const categoryLines = CHANNEL_BLUEPRINT.map((category) => `**${category.name}**\n${category.channels.map((channel) => `↳ ${channel.name}`).join('\n')}`);
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🗺️ Mort Server Map', description: categoryLines.join('\n\n').slice(0, 3900), color: COLORS.lightBlue })] });
    }
    if (interaction.customId === 'mort:help') return interaction.reply({ ephemeral: true, embeds: [helpEmbed()] });
    if (interaction.customId === 'ticket:claim') return claimTicket(interaction);
    if (interaction.customId === 'ticket:unclaim') return unclaimTicket(interaction);
    if (interaction.customId === 'ticket:close') return closeTicket(interaction);
  } catch (error) {
    const context = { event: 'interactionCreate', guildId: interaction.guild?.id, channelId: interaction.channel?.id, userId: interaction.user?.id, command: interaction.isChatInputCommand?.() ? interaction.commandName : interaction.customId };
    persistError(error, context);
    const message = missingPermissionMessage(error) || error?.message || 'Something went wrong.';
    const payload = { ephemeral: true, embeds: [themedEmbed({ title: '⚠️ Mort Error', description: `${message}\n\nMort recorded this in server insights. Staff can run \`/mort insights\` or \`/mort doctor\`.`, color: COLORS.danger })] };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
    else await interaction.reply(payload).catch(() => null);
  }
});

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  if (/token/i.test(String(error?.message || error))) console.error('Discord rejected DISCORD_TOKEN. Reset it in the Discord Developer Portal and update the deployment variable.');
  fatal(error, 'login');
});
