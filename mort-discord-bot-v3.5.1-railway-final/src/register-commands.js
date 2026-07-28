require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const { findDuplicateNames } = require('./utils/duplicateNames');

function collectCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const getCommands = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        getCommands(filePath);
      } else if (file.endsWith('.js')) {
        const command = require(filePath);
        if (command?.data) {
          const json = command.data.toJSON();
          if (!json.name || !json.description) throw new Error(`Invalid command metadata in ${filePath}`);
          commands.push(json);
        }
      }
    }
  };
  getCommands(commandsPath);

  // Registering duplicate top-level command names silently makes Discord
  // keep only one of them, so the mismatch would only surface later as a
  // "command not found" bug in production. Catch it before any API call.
  const duplicates = findDuplicateNames(commands.map((c) => c.name));
  if (duplicates.length) {
    throw new Error(`Duplicate slash command name(s) found before registration: ${duplicates.join(', ')}. Rename one of each pair in src/commands/.`);
  }

  return commands;
}

async function registerCommands(options = {}) {
  const { exitOnError = true } = options;
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token) {
    const error = new Error('Missing DISCORD_TOKEN in .env');
    console.error(error.message);
    if (exitOnError) process.exit(1);
    throw error;
  }

  if (!clientId) {
    // There used to be a hardcoded fallback application ID here. That is
    // unsafe: it silently pointed command registration at a specific
    // Discord application that is *not* this bot, so a deployment missing
    // CLIENT_ID would either register commands to someone else's app ID
    // (a 403/404 from Discord) or, worse, appear to "work" while actually
    // doing nothing useful. Fail loudly and specifically instead.
    const error = new Error('Missing CLIENT_ID in .env. Set it to your bot\'s Application ID from the Discord Developer Portal.');
    console.error(error.message);
    if (exitOnError) process.exit(1);
    throw error;
  }

  const commands = collectCommands();
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(`Registering ${commands.length} Mort slash commands...`);

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`Registered guild commands for ${guildId}.`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('Registered global commands.');
    }

    return { count: commands.length, guildId: guildId || null };
  } catch (error) {
    if (error?.status === 401 || /unauthorized|token/i.test(String(error?.message))) {
      console.error('Discord rejected DISCORD_TOKEN. Reset the token in Discord Developer Portal and update Railway Variables.');
    }
    console.error(error);
    if (exitOnError) process.exit(1);
    throw error;
  }
}

if (require.main === module) {
  registerCommands({ exitOnError: true });
}

module.exports = {
  registerCommands,
  collectCommands,
  findDuplicateNames
};
