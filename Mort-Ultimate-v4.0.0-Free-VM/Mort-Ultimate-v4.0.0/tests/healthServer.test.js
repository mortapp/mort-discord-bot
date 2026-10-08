const test = require('node:test');
const assert = require('node:assert/strict');
const { healthPayload, wsStatusName } = require('../src/services/healthServer');

const client = {
  isReady: () => false,
  ws: { status: 5 },
  guilds: { cache: { size: 3 } },
  commands: { size: 32 }
};

test('health payload distinguishes liveness from readiness', () => {
  const payload = healthPayload(client, Date.now() - 2_000, false);
  assert.equal(payload.ok, false);
  assert.equal(payload.discord, 'disconnected');
  assert.equal(payload.guildCount, 3);
  assert.equal(payload.commandCount, 32);
  assert.match(payload.version, /^4\./);
});

test('websocket status rendering is deterministic', () => {
  assert.equal(wsStatusName(0), 'ready');
  assert.equal(wsStatusName(99), 'unknown');
});
