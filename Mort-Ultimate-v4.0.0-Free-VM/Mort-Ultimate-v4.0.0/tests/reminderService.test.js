const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mort-reminder-test-'));
process.env.DATA_FILE = path.join(tmpDir, 'mort-memory.json');
const { createReminder, listReminders, cancelReminder, stopReminderScheduler } = require('../src/services/reminderService');

const client = { users: { fetch: async () => null } };
const interaction = {
  guild: { id: 'guild-reminder' },
  user: { id: 'user-reminder' },
  channel: { id: 'channel-reminder' }
};

test('a reminder is persisted, listed, and cancelled by its owner', () => {
  const reminder = createReminder(client, interaction, 60, 'Keep this reminder');
  const listed = listReminders(interaction.guild.id, interaction.user.id);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, reminder.id);
  assert.equal(listed[0].text, 'Keep this reminder');
  assert.equal(cancelReminder(client, interaction.guild.id, interaction.user.id, reminder.id), true);
  assert.deepEqual(listReminders(interaction.guild.id, interaction.user.id), []);
});

test.after(() => stopReminderScheduler());
