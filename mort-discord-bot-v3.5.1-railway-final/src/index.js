require('dotenv').config();

const fs = require('fs');
const path = require('path');
const {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  ActivityType
} = require('discord.js');
const { logError, getGuild, updateGuild } = require('./services/dataStore');
const { themedEmbed } = require('./utils/theme');
const { COLORS, CHANNEL_BLUEPRINT } = require('./config/blueprint');
const { openTicket, claimTicket, unclaimTicket, closeTicket } = require('./services/ticketService');
const { helpEmbed } = require('./services/panelService');
const { handleVoiceStateUpdate } = require('./services/voiceService');
const { handleMessageCreate } = require('./services/automodService');
const { handleEngagementMessage } = require('./services/engagementService');
const { handleGuildMemberAdd, handleGuildMemberRemove, sendVerifiedWelcome } = require('./services/welcomeService');
const { handleRaidJoin } = require('./services/raidService');
const { handleReactionAdd } = require('./services/starboardService');
const { handleAuditLogEntry } = require('./services/antinukeService');
const { startHealthServer } = require('./services/healthServer');
const { handleMentionQuestion } = require('./services/assistantService');
const { diagnosePermissions, permissionFixText, missingPermissionMessage, canManageRole } = require('./services/permissionService');
const { registerCommands } = require('./register-commands');
const { stopCooldownSweep } = require('./utils/cooldown');

// Global safety nets: log to Mort's own insights store instead of
// letting an unhandled rejection or exception silently kill the process
// (or worse, crash it with no record of why).
process.on('unhandledRejection', (reason) => {
  console.error('[Mort] Unhandled promise rejection:', reason);
  try {
    logError(reason instanceof Error ? reason : new Error(String(reason)), { event: 'unhandledRejection' });
  } catch (e) { /* dataStore itself failing shouldn't crash the process */ }
});

process.on('uncaughtException', (error) => {
  console.error('[Mort] Uncaught exception:', error);
  try {
    logError(error, { event: 'uncaughtException' });
  } catch (e) { /* ignore */ }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN. Copy .env.example to .env and add your bot token.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration // required for guildAuditLogEntryCreate (anti-nuke)
  ]
});

// Bind the health server immediately, before login even starts. Railway's
// healthcheck (and any reconnect window) needs a live endpoint regardless
// of whether Discord is currently connected -- see healthServer.js.
const healthServer = startHealthServer(client);

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const loadCommands = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      loadCommands(filePath);
    } else if (file.endsWith('.js')) {
      const command = require(filePath);
      if (command?.data?.name && command?.execute) {
        client.commands.set(command.data.name, command);
      }
    }
  }
};
loadCommands(commandsPath);

client.once(Events.ClientReady, async (readyClient) => {
  console.log('════════════════════════════════════════');
  console.log(`Mort v3.5.0 starting on Node ${process.version}`);
  console.log(`Commands loaded: ${client.commands.size}`);
  console.log(`Guilds connected: ${readyClient.guilds.cache.size}`);
  console.log(`Mort is online as ${readyClient.user.tag}`);
  console.log('════════════════════════════════════════');
  readyClient.user.setPresence({
    activities: [{ name: 'Mort v3.5 • @Mort ask me ✦', type: ActivityType.Watching }],
    status: 'online'
  });

  if (process.env.AUTO_REGISTER_COMMANDS !== 'false') {
    registerCommands({ exitOnError: false }).catch((error) => {
      console.error('[Mort] Command auto-register failed:', error?.message || error);
      logError(error, { event: 'autoRegisterCommands' });
    });
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    await handleGuildMemberAdd(member);
    await handleRaidJoin(member);
  } catch (error) {
    logError(error, { event: 'guildMemberAdd', guildId: member.guild?.id, userId: member.id });
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  try {
    await handleGuildMemberRemove(member);
  } catch (error) {
    logError(error, { event: 'guildMemberRemove', guildId: member.guild?.id, userId: member.id });
  }
});

client.on(Events.ChannelDelete, async (channel) => {
  if (!channel.guild) return;
  try {
    updateGuild(channel.guild.id, (memory) => {
      if (memory.tickets?.[channel.id]) delete memory.tickets[channel.id];
      if (memory.tempVoiceRooms?.[channel.id]) delete memory.tempVoiceRooms[channel.id];
      if (memory.privateRooms?.[channel.id]) delete memory.privateRooms[channel.id];
    });
  } catch (error) {
    logError(error, { event: 'channelDelete', guildId: channel.guild?.id, channelId: channel.id });
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    await handleVoiceStateUpdate(oldState, newState);
  } catch (error) {
    logError(error, { event: 'voiceStateUpdate', guildId: newState.guild?.id || oldState.guild?.id });
  }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  try {
    await handleReactionAdd(reaction, user);
  } catch (error) {
    logError(error, { event: 'messageReactionAdd', guildId: reaction.message?.guild?.id });
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (await handleMentionQuestion(message)) return;
    await handleMessageCreate(message);
    await handleEngagementMessage(message);
  } catch (error) {
    logError(error, { event: 'messageCreate', guildId: message.guild?.id, channelId: message.channel?.id });
  }
});

client.on(Events.GuildAuditLogEntryCreate, async (auditLogEntry, guild) => {
  try {
    await handleAuditLogEntry(auditLogEntry, guild);
  } catch (error) {
    logError(error, { event: 'guildAuditLogEntryCreate', guildId: guild?.id });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, client);
      return;
    }

    if (interaction.isButton()) {
      const memory = getGuild(interaction.guild.id);

      if (interaction.customId === 'mort:verify') {
        const verifiedRoleId = memory.config?.verifiedRoleId || memory.roles?.verified;
        const memberRoleId = memory.config?.memberRoleId || memory.roles?.member;
        const unverifiedRoleId = memory.config?.unverifiedRoleId || memory.roles?.unverified;
        if (!verifiedRoleId || !memberRoleId) {
          return interaction.reply({ ephemeral: true, content: 'Mort cannot find the Member/Verified roles. Run `/setup repair` or `/verify repair`.' });
        }
        const verifiedRole = await interaction.guild.roles.fetch(verifiedRoleId).catch(() => null);
        const memberRole = await interaction.guild.roles.fetch(memberRoleId).catch(() => null);
        const unverifiedRole = unverifiedRoleId ? await interaction.guild.roles.fetch(unverifiedRoleId).catch(() => null) : null;
        if (!verifiedRole || !memberRole) {
          return interaction.reply({ ephemeral: true, content: 'The Member or Verified role is missing. Run `/setup repair` or `/verify repair`.' });
        }

        const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
        const blockedRoles = [verifiedRole, memberRole, unverifiedRole].filter(Boolean).filter((role) => !canManageRole(botMember, role));
        if (blockedRoles.length) {
          const report = await diagnosePermissions(interaction.guild);
          return interaction.reply({
            ephemeral: true,
            embeds: [themedEmbed({
              title: '⚠️ Mort Needs Role Permission',
              description: `${permissionFixText(report)}

I need to manage: **${blockedRoles.map((role) => role.name).join(', ')}**.`,
              color: COLORS.warning
            })]
          });
        }

        await interaction.member.roles.add([verifiedRole, memberRole], 'Mort verify button');
        if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole, 'Mort verified member').catch(() => null);
        await sendVerifiedWelcome(interaction.member).catch(() => null);
        return interaction.reply({
          ephemeral: true,
          embeds: [themedEmbed({
            title: '✅ Verified',
            description: 'You now have **Member** + **Verified**. The server is unlocked, and the verify channel is hidden from you now.',
            color: COLORS.success
          })]
        });
      }

      if (interaction.customId.startsWith('rr:')) {
        const roleId = interaction.customId.split(':')[1];
        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
        if (!role) return interaction.reply({ ephemeral: true, content: 'That reaction role no longer exists.' });
        const hasRole = interaction.member.roles.cache.has(role.id);
        if (hasRole) {
          await interaction.member.roles.remove(role, 'Mort reaction role toggle');
          return interaction.reply({ ephemeral: true, content: `Removed ${role}.` });
        }
        await interaction.member.roles.add(role, 'Mort reaction role toggle');
        return interaction.reply({ ephemeral: true, content: `Added ${role}.` });
      }

      if (interaction.customId === 'mort:ticket') {
        return openTicket(interaction, 'Opened from Mort panel.');
      }

      if (interaction.customId === 'mort:map') {
        const categoryLines = CHANNEL_BLUEPRINT.map((category) => `**${category.name}**\n${category.channels.map((ch) => `↳ ${ch.name}`).join('\n')}`);
        return interaction.reply({
          ephemeral: true,
          embeds: [themedEmbed({
            title: '🗺️ Mort Server Map',
            description: categoryLines.join('\n\n').slice(0, 3900),
            color: COLORS.lightBlue
          })]
        });
      }

      if (interaction.customId === 'mort:help') {
        return interaction.reply({ ephemeral: true, embeds: [helpEmbed()] });
      }

      if (interaction.customId === 'ticket:claim') {
        return claimTicket(interaction);
      }

      if (interaction.customId === 'ticket:unclaim') {
        return unclaimTicket(interaction);
      }

      if (interaction.customId === 'ticket:close') {
        return closeTicket(interaction);
      }
    }
  } catch (error) {
    const context = {
      event: 'interactionCreate',
      guildId: interaction.guild?.id,
      channelId: interaction.channel?.id,
      userId: interaction.user?.id,
      command: interaction.isChatInputCommand?.() ? interaction.commandName : interaction.customId
    };
    logError(error, context);

    const message = missingPermissionMessage(error) || error?.message || 'Something went wrong.';
    const payload = {
      ephemeral: true,
      embeds: [themedEmbed({
        title: '⚠️ Mort Error',
        description: `${message}\n\nI saved this to Mort insights. Staff can run \`/mort insights\` or \`/mort doctor\`.`,
        color: COLORS.danger
      })]
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => null);
    } else {
      await interaction.reply(payload).catch(() => null);
    }
  }
});

async function shutdown(signal) {
  console.log(`[Mort] ${signal} received. Shutting down cleanly...`);
  try { stopCooldownSweep(); } catch (error) { /* ignore */ }
  if (healthServer) {
    await new Promise((resolve) => healthServer.close(() => resolve())).catch(() => null);
  }
  try { await client.destroy(); } catch (error) { console.error('[Mort] destroy failed:', error); }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

client.login(token).catch((error) => {
  console.error('[Mort] Login failed:', error?.message || error);
  if (/token/i.test(String(error?.message || error))) {
    console.error('Discord rejected DISCORD_TOKEN. Reset token in Developer Portal and update Railway Variables.');
  }
  process.exit(1);
});
