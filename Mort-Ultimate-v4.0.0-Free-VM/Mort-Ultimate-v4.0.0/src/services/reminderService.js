const { randomUUID } = require('crypto');
const { getGuild, readState, updateGuild } = require('./dataStore');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');

const timers = new Map();
const MAX_DELAY_MS = 2 ** 31 - 1;

function timerKey(guildId, reminderId) {
  return `${guildId}:${reminderId}`;
}

function clearTimer(guildId, reminderId) {
  const key = timerKey(guildId, reminderId);
  const timer = timers.get(key);
  if (timer) clearTimeout(timer);
  timers.delete(key);
}

function listReminders(guildId, userId) {
  const reminders = Object.entries(getGuild(guildId).reminders || {})
    .map(([id, reminder]) => ({ id, ...reminder }))
    .filter((reminder) => reminder.userId === userId)
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  return reminders;
}

async function deliverReminder(client, guildId, reminderId) {
  clearTimer(guildId, reminderId);
  const reminder = getGuild(guildId).reminders?.[reminderId];
  if (!reminder) return;

  const payload = {
    embeds: [themedEmbed({
      title: '⏰ Mort Reminder',
      description: reminder.text,
      color: COLORS.royalPurple,
      fields: [{ name: 'Originally set', value: `<t:${Math.floor(new Date(reminder.createdAt).getTime() / 1000)}:R>` }]
    })]
  };

  let delivered = false;
  const user = await client.users.fetch(reminder.userId).catch(() => null);
  if (user) delivered = await user.send(payload).then(() => true).catch(() => false);

  if (!delivered) {
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    const channel = guild ? await guild.channels.fetch(reminder.channelId).catch(() => null) : null;
    if (channel?.send) {
      delivered = await channel.send({
        content: `<@${reminder.userId}>`,
        allowedMentions: { users: [reminder.userId] },
        ...payload
      }).then(() => true).catch(() => false);
    }
  }

  updateGuild(guildId, (memory) => { delete memory.reminders[reminderId]; });
  if (!delivered) console.warn(`[Mort] Could not deliver reminder ${reminderId} in guild ${guildId}; it was removed after the delivery attempt.`);
}

function scheduleReminder(client, guildId, reminderId) {
  clearTimer(guildId, reminderId);
  const reminder = getGuild(guildId).reminders?.[reminderId];
  if (!reminder) return false;
  const delay = Math.max(0, new Date(reminder.dueAt).getTime() - Date.now());
  const wait = Math.min(delay, MAX_DELAY_MS);
  const timer = setTimeout(() => {
    if (delay > MAX_DELAY_MS) scheduleReminder(client, guildId, reminderId);
    else deliverReminder(client, guildId, reminderId).catch((error) => console.error('[Mort] Reminder delivery failed:', error));
  }, wait);
  timer.unref?.();
  timers.set(timerKey(guildId, reminderId), timer);
  return true;
}

function createReminder(client, interaction, minutes, text) {
  const reminderId = randomUUID().split('-')[0];
  const createdAt = new Date();
  const dueAt = new Date(createdAt.getTime() + minutes * 60_000);
  const reminder = {
    userId: interaction.user.id,
    channelId: interaction.channel.id,
    text: String(text).trim().slice(0, 500),
    createdAt: createdAt.toISOString(),
    dueAt: dueAt.toISOString()
  };
  updateGuild(interaction.guild.id, (memory) => { memory.reminders[reminderId] = reminder; });
  scheduleReminder(client, interaction.guild.id, reminderId);
  return { id: reminderId, ...reminder };
}

function cancelReminder(client, guildId, userId, reminderId) {
  const reminder = getGuild(guildId).reminders?.[reminderId];
  if (!reminder || reminder.userId !== userId) return false;
  clearTimer(guildId, reminderId);
  updateGuild(guildId, (memory) => { delete memory.reminders[reminderId]; });
  return true;
}

function restoreReminderScheduler(client) {
  const state = readState();
  let restored = 0;
  for (const [guildId, memory] of Object.entries(state.guilds || {})) {
    for (const reminderId of Object.keys(memory.reminders || {})) {
      if (scheduleReminder(client, guildId, reminderId)) restored += 1;
    }
  }
  return restored;
}

function stopReminderScheduler() {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
}

module.exports = {
  createReminder,
  listReminders,
  cancelReminder,
  restoreReminderScheduler,
  stopReminderScheduler,
  scheduleReminder
};
