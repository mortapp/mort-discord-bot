const { updateGuild, getGuild } = require('./dataStore');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');

const cooldowns = new Map();

function levelForXp(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100));
}

function xpForNextLevel(level) {
  return Math.pow(level + 1, 2) * 100;
}

function isVerifiedMember(message, memory) {
  const memberRoleId = memory.config?.memberRoleId || memory.roles?.member;
  const verifiedRoleId = memory.config?.verifiedRoleId || memory.roles?.verified;
  return Boolean(
    message.member?.roles?.cache?.has(memberRoleId)
    || message.member?.roles?.cache?.has(verifiedRoleId)
    || message.member?.permissions?.has('Administrator')
  );
}

async function handleEngagementMessage(message) {
  if (!message.guild || message.author.bot) return;
  const memory = getGuild(message.guild.id);
  if (memory.config?.xpEnabled === false) return;
  if (!isVerifiedMember(message, memory)) return;

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  if ((cooldowns.get(key) || 0) > now) return;
  cooldowns.set(key, now + 60_000);

  const gained = Math.floor(Math.random() * 8) + 8;
  let leveledUp = false;
  let userXp = null;

  updateGuild(message.guild.id, (guild) => {
    guild.xp ||= {};
    const current = guild.xp[message.author.id] || { xp: 0, messages: 0, level: 0 };
    const before = levelForXp(current.xp);
    current.xp += gained;
    current.messages += 1;
    current.level = levelForXp(current.xp);
    current.lastMessageAt = new Date().toISOString();
    guild.xp[message.author.id] = current;
    userXp = current;
    leveledUp = current.level > before;
  });

  if (leveledUp && memory.config?.levelAnnouncements !== false) {
    await message.channel.send({
      embeds: [themedEmbed({
        title: '✦ Mort Level Up',
        description: `${message.author} reached **Level ${userXp.level}**. Keep cooking.`,
        color: COLORS.royalPurple
      })]
    }).then((sent) => setTimeout(() => sent.delete().catch(() => null), 12000)).catch(() => null);
  }
}

function getRank(guildId, userId) {
  const memory = getGuild(guildId);
  const entry = memory.xp?.[userId] || { xp: 0, messages: 0, level: 0 };
  const sorted = Object.entries(memory.xp || {}).sort((a, b) => (b[1].xp || 0) - (a[1].xp || 0));
  const rank = sorted.findIndex(([id]) => id === userId) + 1;
  return {
    ...entry,
    rank: rank || null,
    nextLevelXp: xpForNextLevel(entry.level || 0)
  };
}

function getLeaderboard(guildId, limit = 10) {
  const memory = getGuild(guildId);
  return Object.entries(memory.xp || {})
    .sort((a, b) => (b[1].xp || 0) - (a[1].xp || 0))
    .slice(0, limit)
    .map(([userId, data], index) => ({ userId, ...data, rank: index + 1 }));
}

module.exports = {
  handleEngagementMessage,
  getRank,
  getLeaderboard,
  levelForXp,
  xpForNextLevel
};
