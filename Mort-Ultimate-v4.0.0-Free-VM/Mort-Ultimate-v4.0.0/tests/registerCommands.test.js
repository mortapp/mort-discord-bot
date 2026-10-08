const test = require('node:test');
const assert = require('node:assert/strict');
const { findDuplicateNames } = require('../src/utils/duplicateNames');
const { collectCommands } = require('../src/register-commands');

test('findDuplicateNames returns [] when all names are unique', () => {
  assert.deepEqual(findDuplicateNames(['ticket', 'mod', 'verify']), []);
});

test('findDuplicateNames flags a repeated command name', () => {
  assert.deepEqual(findDuplicateNames(['ticket', 'mod', 'ticket']), ['ticket']);
});

test('findDuplicateNames flags each distinct duplicate once', () => {
  const result = findDuplicateNames(['a', 'b', 'a', 'b', 'c']).sort();
  assert.deepEqual(result, ['a', 'b']);
});

test('the checked-in command tree has unique guild-only metadata', () => {
  const commands = collectCommands();
  assert.ok(commands.length >= 30, 'expected the full Mort command set');
  assert.deepEqual(findDuplicateNames(commands.map((command) => command.name)), []);
  assert.ok(commands.every((command) => command.dm_permission === false));
  assert.ok(commands.every((command) => command.name && command.description));
});
