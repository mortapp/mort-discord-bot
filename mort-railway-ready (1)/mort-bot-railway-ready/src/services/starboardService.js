const { getGuild, getStarboardEntry, setStarboardEntry } = require('./dataStore');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');

function buildEmbed(message, count) {
  const embed = themedEmbed({
    title: `⭐ ${count} | ${message.channel.name}`,
    description: `${message.content}\n\n[Jump to message](${message.url})`,
    color: COLORS.gold,
    footer: false
  }).setAuthor({
    name: message.author.tag,
    iconURL: message.author.displayAvatarURL()
  }).setTimestamp(message.createdAt);

  if (message.attachments.size > 0) {
    embed.setImage(message.attachments.first().url);
  }
  return embed;
}

async function handleReactionAdd(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);
  if (!reaction.message) return;
  if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

  if (reaction.emoji.name !== '⭐') return;
  if (!reaction.message.guild || reaction.message.author.bot) return;

  const memory = getGuild(reaction.message.guild.id);
  const starboardId = memory.config?.starboardChannelId;
  const threshold = memory.config?.starboardThreshold || 3;

  if (!starboardId) return;
  if (reaction.count < threshold) return;

  const starboardChannel = await reaction.message.guild.channels.fetch(starboardId).catch(() => null);
  if (!starboardChannel) return;

  const guildId = reaction.message.guild.id;
  const sourceId = reaction.message.id;
  const existing = getStarboardEntry(guildId, sourceId);

  const embed = buildEmbed(reaction.message, reaction.count);

  if (existing?.starboardMessageId) {
    // Already posted: edit the existing post's star count instead of
    // creating a duplicate. This was the original bug — every new
    // reaction re-posted the message from scratch.
    const existingMessage = await starboardChannel.messages.fetch(existing.starboardMessageId).catch(() => null);
    if (existingMessage) {
      await existingMessage.edit({ embeds: [embed] }).catch(() => null);
      return;
    }
    // Fall through and re-post if the original starboard message was deleted.
  }

  const sent = await starboardChannel.send({ embeds: [embed] }).catch(() => null);
  if (sent) {
    setStarboardEntry(guildId, sourceId, { starboardMessageId: sent.id, channelId: reaction.message.channel.id, postedAt: new Date().toISOString() });
  }
}

module.exports = { handleReactionAdd };
