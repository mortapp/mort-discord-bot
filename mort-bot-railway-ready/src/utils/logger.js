const { themedEmbed } = require('./theme');
const { COLORS } = require('../config/blueprint');

function getLogChannelId(guildMemory) {
  return guildMemory?.config?.logChannelId
    || guildMemory?.channels?.modLogs
    || guildMemory?.channels?.staffCommands
    || null;
}

async function getLogChannel(guild, guildMemory) {
  const logId = getLogChannelId(guildMemory);
  if (!logId) return null;
  const channel = await guild.channels.fetch(logId).catch(() => null);
  if (!channel || !channel.isTextBased()) return null;
  return channel;
}

async function sendLog(guild, guildMemory, title, description, color = COLORS.lightBlue) {
  const channel = await getLogChannel(guild, guildMemory);
  if (!channel) return null;
  return channel.send({ embeds: [themedEmbed({ title, description, color })] }).catch(() => null);
}

module.exports = { sendLog, getLogChannel, getLogChannelId };
