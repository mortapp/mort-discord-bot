const test = require('node:test');
const assert = require('node:assert/strict');
const { findDuplicateNames } = require('../src/utils/duplicateNames');

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
