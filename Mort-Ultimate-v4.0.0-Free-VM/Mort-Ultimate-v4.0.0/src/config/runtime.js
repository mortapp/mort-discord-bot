const path = require('path');
const packageJson = require('../../package.json');

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseInteger(value, { fallback, min, max, name }) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

function optionalPort() {
  const raw = process.env.PORT ?? process.env.HEALTH_PORT;
  if (raw === undefined || raw === '') return null;
  return parseInteger(raw, { fallback: null, min: 1, max: 65535, name: 'PORT' });
}

function dataFilePath() {
  return path.resolve(process.cwd(), process.env.DATA_FILE || './data/mort-memory.json');
}

function runtimeConfig() {
  return {
    version: packageJson.version,
    nodeEnv: process.env.NODE_ENV || 'development',
    dataFile: dataFilePath(),
    port: optionalPort(),
    autoRegisterCommands: parseBoolean(process.env.AUTO_REGISTER_COMMANDS, false),
    assistantEnabled: parseBoolean(process.env.ASSISTANT_ENABLED, true),
    assistantCooldownSeconds: parseInteger(process.env.ASSISTANT_COOLDOWN_SECONDS, {
      fallback: 8,
      min: 1,
      max: 3600,
      name: 'ASSISTANT_COOLDOWN_SECONDS'
    }),
    assistantMaxResponseLength: parseInteger(process.env.ASSISTANT_MAX_RESPONSE_LENGTH, {
      fallback: 1800,
      min: 100,
      max: 3900,
      name: 'ASSISTANT_MAX_RESPONSE_LENGTH'
    })
  };
}

function validateStartupConfig({ requireDiscord = true } = {}) {
  const config = runtimeConfig();
  const failures = [];

  if (requireDiscord && !process.env.DISCORD_TOKEN) failures.push('DISCORD_TOKEN is required.');
  if (config.autoRegisterCommands && !process.env.CLIENT_ID) {
    failures.push('CLIENT_ID is required when AUTO_REGISTER_COMMANDS=true.');
  }

  return { config, failures };
}

module.exports = {
  parseBoolean,
  parseInteger,
  dataFilePath,
  runtimeConfig,
  validateStartupConfig
};
