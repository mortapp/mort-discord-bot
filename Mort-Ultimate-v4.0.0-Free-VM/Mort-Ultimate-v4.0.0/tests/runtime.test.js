const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBoolean, parseInteger } = require('../src/config/runtime');

test('runtime boolean parser recognizes explicit values and fallbacks', () => {
  assert.equal(parseBoolean('true'), true);
  assert.equal(parseBoolean('OFF', true), false);
  assert.equal(parseBoolean(undefined, true), true);
  assert.equal(parseBoolean('unknown', false), false);
});

test('runtime integer parser rejects invalid or unsafe configuration', () => {
  assert.equal(parseInteger('8', { fallback: 1, min: 1, max: 10, name: 'TEST' }), 8);
  assert.equal(parseInteger(undefined, { fallback: 5, min: 1, max: 10, name: 'TEST' }), 5);
  assert.throws(() => parseInteger('NaN', { fallback: 5, min: 1, max: 10, name: 'TEST' }), /TEST/);
  assert.throws(() => parseInteger('11', { fallback: 5, min: 1, max: 10, name: 'TEST' }), /between/);
});
