const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// dataStore.js resolves its file relative to process.cwd() + DATA_FILE at
// require-time, so point it at an isolated temp file per test run before
// requiring the module.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mort-datastore-test-'));
process.env.DATA_FILE = path.join(tmpDir, 'mort-memory.json');

const dataStore = require('../src/services/dataStore');

test('creates a default state file on first read', () => {
  const state = dataStore.readState();
  assert.equal(state.version, 2);
  assert.deepEqual(state.guilds, {});
  assert.ok(fs.existsSync(process.env.DATA_FILE));
});

test('getGuild returns and persists a default guild shape', () => {
  const guild = dataStore.getGuild('guild-1');
  assert.deepEqual(guild.tickets, {});
  assert.equal(guild.caseSeq, 0);

  const onDisk = JSON.parse(fs.readFileSync(process.env.DATA_FILE, 'utf8'));
  assert.ok(onDisk.guilds['guild-1'], 'guild should be persisted to disk, not just cached in memory');
});

test('writeState is atomic: no .tmp file left behind after a write', () => {
  dataStore.updateGuild('guild-1', (guild) => { guild.config.testFlag = true; });
  const leftoverTmp = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.tmp'));
  assert.deepEqual(leftoverTmp, [], 'temp files used for atomic rename should not survive a completed write');
});

test('addWarning increments a per-guild case sequence and getWarnings reads it back', () => {
  const entry = dataStore.addWarning('guild-2', 'user-9', { moderatorId: 'mod-1', reason: 'spam' });
  assert.equal(entry.case, 1);
  const warnings = dataStore.getWarnings('guild-2', 'user-9');
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].reason, 'spam');
});

test('removeWarning removes only the targeted case', () => {
  dataStore.addWarning('guild-3', 'user-1', { moderatorId: 'mod-1', reason: 'a' });
  const second = dataStore.addWarning('guild-3', 'user-1', { moderatorId: 'mod-1', reason: 'b' });
  const removed = dataStore.removeWarning('guild-3', 'user-1', second.case);
  assert.equal(removed, true);
  const remaining = dataStore.getWarnings('guild-3', 'user-1');
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].reason, 'a');
});

test('logError caps stored errors at 100 entries', () => {
  for (let i = 0; i < 110; i++) {
    dataStore.logError(new Error(`err-${i}`), { event: 'test' });
  }
  const state = dataStore.readState();
  assert.equal(state.errors.length, 100, 'error log should be capped, not grow unbounded');
  assert.equal(state.errors[0].message, 'err-109', 'newest error should be first');
});

test('recovers from a corrupted JSON file instead of crashing', () => {
  const brokenFile = path.join(tmpDir, 'broken.json');
  fs.writeFileSync(brokenFile, '{ this is not valid json ');
  const prevFile = process.env.DATA_FILE;
  process.env.DATA_FILE = brokenFile;

  // Force a fresh module load so it re-resolves DATA_FILE and re-reads
  // from disk instead of using the already-cached state from prior tests.
  delete require.cache[require.resolve('../src/services/dataStore')];
  const freshStore = require('../src/services/dataStore');

  const state = freshStore.readState();
  assert.deepEqual(state.guilds, {}, 'should fall back to a fresh empty state');

  const backups = fs.readdirSync(tmpDir).filter((f) => f.startsWith('broken.json.') && f.endsWith('.broken'));
  assert.equal(backups.length, 1, 'the corrupted file should be preserved as a .broken backup, not silently discarded');

  process.env.DATA_FILE = prevFile;
  delete require.cache[require.resolve('../src/services/dataStore')];
});
