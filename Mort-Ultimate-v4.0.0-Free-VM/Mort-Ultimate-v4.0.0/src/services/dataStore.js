const fs = require('fs');
const path = require('path');
const { dataFilePath } = require('../config/runtime');

const resolvedFile = dataFilePath();
const STATE_VERSION = 4;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultState() {
  return { version: STATE_VERSION, guilds: {}, errors: [], repairHistory: [] };
}

function defaultGuild() {
  return {
    config: {}, roles: {}, categories: {}, channels: {}, tickets: {}, tempVoiceRooms: {},
    privateRooms: {}, xp: {}, warnings: {}, suggestions: {}, starboardPosts: {}, economy: {},
    reminders: {}, reactionRolePanels: {}, channelLocks: {}, raidLockdown: null, caseSeq: 0
  };
}

function objectOrEmpty(value) { return isRecord(value) ? value : {}; }
function arrayOrEmpty(value) { return Array.isArray(value) ? value : []; }

function normalizeGuild(input) {
  const source = objectOrEmpty(input);
  const guild = { ...defaultGuild(), ...source };
  for (const key of [
    'config', 'roles', 'categories', 'channels', 'tickets', 'tempVoiceRooms', 'privateRooms',
    'xp', 'warnings', 'suggestions', 'starboardPosts', 'economy', 'reminders',
    'reactionRolePanels', 'channelLocks'
  ]) guild[key] = objectOrEmpty(guild[key]);
  guild.raidLockdown = isRecord(guild.raidLockdown) ? guild.raidLockdown : null;
  guild.caseSeq = Number.isSafeInteger(guild.caseSeq) && guild.caseSeq >= 0 ? guild.caseSeq : 0;
  return guild;
}

function normalizeState(input) {
  const source = objectOrEmpty(input);
  const normalized = {
    ...defaultState(),
    ...source,
    version: STATE_VERSION,
    guilds: {},
    errors: arrayOrEmpty(source.errors).slice(0, 100),
    repairHistory: arrayOrEmpty(source.repairHistory).slice(0, 50)
  };
  for (const [guildId, guild] of Object.entries(objectOrEmpty(source.guilds))) {
    normalized.guilds[guildId] = normalizeGuild(guild);
  }
  return normalized;
}

let cache = null;

function ensureDirectory() {
  fs.mkdirSync(path.dirname(resolvedFile), { recursive: true });
}

function writeFileAtomically(state) {
  ensureDirectory();
  const tmpFile = `${resolvedFile}.${process.pid}.${Date.now()}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(tmpFile, 'w', 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    fs.fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
  fs.renameSync(tmpFile, resolvedFile);

  let directoryDescriptor;
  try {
    directoryDescriptor = fs.openSync(path.dirname(resolvedFile), 'r');
    fs.fsyncSync(directoryDescriptor);
  } catch (error) {
    // Directory fsync is not supported by every hosting filesystem.
  } finally {
    if (directoryDescriptor !== undefined) fs.closeSync(directoryDescriptor);
  }
}

function loadFromDisk() {
  ensureDirectory();
  if (!fs.existsSync(resolvedFile)) {
    const fresh = defaultState();
    writeFileAtomically(fresh);
    return fresh;
  }

  let raw;
  try {
    raw = fs.readFileSync(resolvedFile, 'utf8');
  } catch (error) {
    throw new Error(`Mort could not read DATA_FILE (${resolvedFile}): ${error.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    const backup = `${resolvedFile}.${Date.now()}.broken`;
    fs.copyFileSync(resolvedFile, backup);
    const fresh = defaultState();
    writeFileAtomically(fresh);
    console.error(`[Mort] Invalid JSON state was preserved at ${backup} and reset.`);
    return fresh;
  }

  const normalized = normalizeState(parsed);
  if (JSON.stringify(parsed) !== JSON.stringify(normalized)) writeFileAtomically(normalized);
  return normalized;
}

function readState() {
  if (!cache) cache = loadFromDisk();
  return cache;
}

function writeState(state) {
  const normalized = normalizeState(clone(state));
  writeFileAtomically(normalized);
  cache = normalized; // Publish only after durable write + rename succeeds.
  return cache;
}

function nextState() { return clone(readState()); }

function getGuild(guildId) {
  if (!readState().guilds[guildId]) {
    const candidate = nextState();
    candidate.guilds[guildId] = defaultGuild();
    writeState(candidate);
  }
  return readState().guilds[guildId];
}

function updateGuild(guildId, patcher) {
  const candidate = nextState();
  candidate.guilds[guildId] = normalizeGuild(candidate.guilds[guildId]);
  patcher(candidate.guilds[guildId]);
  writeState(candidate);
  return readState().guilds[guildId];
}

function logError(error, context = {}) {
  const candidate = nextState();
  candidate.errors.unshift({
    at: new Date().toISOString(),
    name: error?.name || 'Error',
    message: error?.message || String(error),
    stack: String(error?.stack || '').split('\n').slice(0, 8).join('\n'),
    context
  });
  candidate.errors = candidate.errors.slice(0, 100);
  writeState(candidate);
}

function logRepair(guildId, summary) {
  const candidate = nextState();
  candidate.repairHistory.unshift({ at: new Date().toISOString(), guildId, summary });
  candidate.repairHistory = candidate.repairHistory.slice(0, 50);
  writeState(candidate);
}

function addTicket(guildId, channelId, ticket) {
  return updateGuild(guildId, (guild) => { guild.tickets[channelId] = ticket; });
}

function removeTicket(guildId, channelId) {
  return updateGuild(guildId, (guild) => { delete guild.tickets[channelId]; });
}

function addTempVoiceRoom(guildId, channelId, data) {
  return updateGuild(guildId, (guild) => { guild.tempVoiceRooms[channelId] = data; });
}

function removeTempVoiceRoom(guildId, channelId) {
  return updateGuild(guildId, (guild) => { delete guild.tempVoiceRooms[channelId]; });
}

function addWarning(guildId, userId, warning) {
  let created = null;
  updateGuild(guildId, (guild) => {
    guild.caseSeq += 1;
    created = {
      case: guild.caseSeq, userId, moderatorId: warning.moderatorId,
      reason: warning.reason || 'No reason provided.', source: warning.source || 'manual',
      at: new Date().toISOString()
    };
    guild.warnings[userId] ||= [];
    guild.warnings[userId].push(created);
  });
  return created;
}

function getWarnings(guildId, userId) { return getGuild(guildId).warnings?.[userId] || []; }

function removeWarning(guildId, userId, caseId) {
  let removed = false;
  updateGuild(guildId, (guild) => {
    const list = guild.warnings?.[userId] || [];
    const next = list.filter((entry) => entry.case !== caseId);
    removed = next.length !== list.length;
    guild.warnings[userId] = next;
  });
  return removed;
}

function getStarboardEntry(guildId, sourceMessageId) {
  return getGuild(guildId).starboardPosts?.[sourceMessageId] || null;
}

function setStarboardEntry(guildId, sourceMessageId, entry) {
  return updateGuild(guildId, (guild) => { guild.starboardPosts[sourceMessageId] = entry; });
}

function getInsights(guildId) {
  const state = readState();
  const guildErrors = state.errors.filter((entry) => entry.context?.guildId === guildId);
  const grouped = guildErrors.reduce((acc, entry) => {
    const key = entry.message || entry.name;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    totalErrors: guildErrors.length,
    topErrors: Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([message, count]) => ({ message, count })),
    latestErrors: guildErrors.slice(0, 5),
    repairHistory: state.repairHistory.filter((entry) => entry.guildId === guildId).slice(0, 5)
  };
}

function getDataFile() { return resolvedFile; }
function getDataDirectory() { return path.dirname(resolvedFile); }

module.exports = {
  STATE_VERSION, defaultGuild, normalizeGuild, normalizeState, readState, writeState, getGuild,
  updateGuild, logError, logRepair, addTicket, removeTicket, addTempVoiceRoom,
  removeTempVoiceRoom, addWarning, getWarnings, removeWarning, getStarboardEntry,
  setStarboardEntry, getInsights, getDataFile, getDataDirectory
};
