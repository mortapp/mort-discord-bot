const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const { assertSafeAssignableRole, isPrivilegedRole } = require('../src/utils/guards');

function makeRole({ privileged = false, managed = false, position = -1 } = {}) {
  return {
    id: 'role-1',
    name: 'Community',
    managed,
    permissions: { has: (permission) => privileged && permission === PermissionFlagsBits.Administrator },
    comparePositionTo: () => position
  };
}

const guild = { id: 'guild-1', members: { me: { roles: { highest: {} } } } };

test('a safe role can be explicitly approved for self-assignment', () => {
  assert.doesNotThrow(() => assertSafeAssignableRole(guild, makeRole()));
});

test('privileged and unmanageable roles are rejected for self-assignment', () => {
  assert.equal(isPrivilegedRole(makeRole({ privileged: true })), true);
  assert.throws(() => assertSafeAssignableRole(guild, makeRole({ privileged: true })), /refuses/);
  assert.throws(() => assertSafeAssignableRole(guild, makeRole({ position: 0 })), /cannot manage/);
});
