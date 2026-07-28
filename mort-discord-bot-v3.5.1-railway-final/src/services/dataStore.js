const fs = require('fs');
const path = require('path');

const DATA_FILE = process.env.DATA_FILE || './data/mort-memory.json';
const resolvedFile = path.resolve(process.cwd(), DATA_FILE);

const defaultState = {
  version: 2,
  guilds: {},
  errors: [],
  repairHistory: []
};

function defaultGuild() {
  return {
    config: {},
    roles: {},
    categories: {},
    channels: {},
    tickets: {},
    tempVoiceRooms: {},
    privateRooms: {},
    xp: {},
    warnings: {},
    suggestions: {},
    starboardPosts: {},
    economy: {},
    reminders: {},
    caseSeq: 0
  };
}

// --- In-memory cache -------------------------------------------------
// Avoids a disk read on every single call (getGuild is hit on nearly
// every message/event). The cache is the source of truth once loaded;
// writes go to disk (atomically) and update the cache in place so
// callers that mutate the returned object and pass it to writeState
// keep working exactly like before.
let cache = null;

function ensureFile() {
  fs.mkdirSync(path.dirname(resolvedFile), { recursive: true });
  if (!fs.existsSync(resolvedFile)) {
    fs.writeFileSync(resolvedFile, JSON.stringify(defaultState, null, 2));
  }
}

function loadFromDisk() {
  ensureFile();
  try {
    const raw = fs.readFileSync(resolvedFile, 'utf8');
    return { ...defaultState, ...JSON.parse(raw) };
  } catch (error) {
    const backup = `${resolvedFile}.${Date.now()}.broken`;
    if (fs.existsSync(resolvedFile)) fs.copyFileSync(resolvedFile, backup);
    const fresh = { ...defaultState, guilds: {}, errors: [], repairHistory: [] };
    fs.writeFileSync(resolvedFile, JSON.stringify(fresh, null, 2));
    return fresh;
  }
}

function readState() {
  if (!cache) cache = loadFromDisk();
  return cache;
}

function writeState(state) {
  cache = state;
  ensureFile();
  // Atomic write: write to a temp file then rename, so a crash mid-write
  // can never leave mort-memory.json truncated/corrupted.
  const tmpFile = `${resolvedFile}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2));
  fs.renameSync(tmpFile, resolvedFile);
}

function getGuild(guildId) {
  const state = readState();
  if (!state.guilds[guildId]) {
    state.guilds[guildId] = defaultGuild();
    writeState(state);
  }
  return state.guilds[guildId];
}

function updateGuild(guildId, patcher) {
  const state = readState();
  if (!state.guilds[guildId]) {
    state.guilds[guildId] = defaultGuild();
  }
  patcher(state.guilds[guildId]);
  writeState(state);
  return state.guilds[guildId];
}

function logError(error, context = {}) {
  const state = readState();
  state.errors.unshift({
    at: new Date().toISOString(),
    name: error?.name || 'Error',
    message: error?.message || String(error),
    stack: String(error?.stack || '').split('\n').slice(0, 8).join('\n'),
    context
  });
  state.errors = state.errors.slice(0, 100);
  writeState(state);
}

function logRepair(guildId, summary) {
  const state = readState();
  state.repairHistory.unshift({
    at: new Date().toISOString(),
    guildId,
    summary
  });
  state.repairHistory = state.repairHistory.slice(0, 50);
  writeState(state);
}

function addTicket(guildId, channelId, ticket) {
  return updateGuild(guildId, (guild) => {
    guild.tickets[channelId] = ticket;
  });
}

function removeTicket(guildId, channelId) {
  return updateGuild(guildId, (guild) => {
    delete guild.tickets[channelId];
  });
}

function addTempVoiceRoom(guildId, channelId, data) {
  return updateGuild(guildId, (guild) => {
    guild.tempVoiceRooms[channelId] = data;
  });
}

function removeTempVoiceRoom(guildId, channelId) {
  return updateGuild(guildId, (guild) => {
    delete guild.tempVoiceRooms[channelId];
  });
}

// --- Warnings / moderation case history ------------------------------

function addWarning(guildId, userId, warning) {
  let created = null;
  updateGuild(guildId, (guild) => {
    guild.caseSeq = (guild.caseSeq || 0) + 1;
    const entry = {
      case: guild.caseSeq,
      userId,
      moderatorId: warning.moderatorId,
      reason: warning.reason || 'No reason provided.',
      source: warning.source || 'manual',
      at: new Date().toISOString()
    };
    if (!guild.warnings[userId]) guild.warnings[userId] = [];
    guild.warnings[userId].push(entry);
    created = entry;
  });
  return created;
}

function getWarnings(guildId, userId) {
  const memory = getGuild(guildId);
  return memory.warnings?.[userId] || [];
}

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

// --- Starboard de-duplication -----------------------------------------

function getStarboardEntry(guildId, sourceMessageId) {
  const memory = getGuild(guildId);
  return memory.starboardPosts?.[sourceMessageId] || null;
}

function setStarboardEntry(guildId, sourceMessageId, entry) {
  return updateGuild(guildId, (guild) => {
    if (!guild.starboardPosts) guild.starboardPosts = {};
    guild.starboardPosts[sourceMessageId] = entry;
  });
}

function getInsights(guildId) {
  const state = readState();
  const guildErrors = state.errors.filter((entry) => entry.context?.guildId === guildId);
  const grouped = guildErrors.reduce((acc, entry) => {
    const key = entry.message || entry.name;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topErrors = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([message, count]) => ({ message, count }));

  return {
    totalErrors: guildErrors.length,
    topErrors,
    latestErrors: guildErrors.slice(0, 5),
    repairHistory: state.repairHistory.filter((entry) => entry.guildId === guildId).slice(0, 5)
  };
}

module.exports = {
  readState,
  writeState,
  getGuild,
  updateGuild,
  logError,
  logRepair,
  addTicket,
  removeTicket,
  addTempVoiceRoom,
  removeTempVoiceRoom,
  addWarning,
  getWarnings,
  removeWarning,
  getStarboardEntry,
  setStarboardEntry,
  getInsights
};
