const test = require('node:test');
const assert = require('node:assert/strict');
const { checkCooldown, clearCooldown, formatRemaining } = require('../src/utils/cooldown');

test('first call for a scope/user is never on cooldown', () => {
  const result = checkCooldown('test-scope-a', 'user-1', 60_000);
  assert.equal(result.onCooldown, false);
});

test('a second call within the window is blocked with remaining time', () => {
  checkCooldown('test-scope-b', 'user-1', 60_000);
  const result = checkCooldown('test-scope-b', 'user-1', 60_000);
  assert.equal(result.onCooldown, true);
  assert.ok(result.remainingMs > 0 && result.remainingMs <= 60_000);
});

test('different users do not share a cooldown', () => {
  checkCooldown('test-scope-c', 'user-1', 60_000);
  const result = checkCooldown('test-scope-c', 'user-2', 60_000);
  assert.equal(result.onCooldown, false);
});

test('clearCooldown lets the next call through immediately', () => {
  checkCooldown('test-scope-d', 'user-1', 60_000);
  clearCooldown('test-scope-d', 'user-1');
  const result = checkCooldown('test-scope-d', 'user-1', 60_000);
  assert.equal(result.onCooldown, false);
});

test('formatRemaining renders seconds and minutes sensibly', () => {
  assert.equal(formatRemaining(5_000), '5s');
  assert.equal(formatRemaining(59_000), '59s');
  assert.equal(formatRemaining(60_000), '1m');
  assert.equal(formatRemaining(125_000), '3m');
});
