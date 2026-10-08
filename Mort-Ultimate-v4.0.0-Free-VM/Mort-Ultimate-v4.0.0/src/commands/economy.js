const { SlashCommandBuilder } = require('discord.js');
const { getGuild, updateGuild } = require('../services/dataStore');
const { themedEmbed } = require('../utils/theme');
const { COLORS } = require('../config/blueprint');

const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;
const SHOP = [
  { id: 'badge', name: 'Mort Badge', price: 500, description: 'A clean profile flex item.' },
  { id: 'vip-pass', name: 'VIP Pass', price: 2500, description: 'Fake economy VIP collectible.' },
  { id: 'lucky-charm', name: 'Lucky Charm', price: 1000, description: 'Looks cool in inventory.' }
];

function getUser(guildMemory, userId) {
  if (!guildMemory.economy) guildMemory.economy = {};
  if (!guildMemory.economy[userId]) guildMemory.economy[userId] = { balance: 0, bank: 0, inventory: [], stats: { gambles: 0, wins: 0 } };
  if (!guildMemory.economy[userId].inventory) guildMemory.economy[userId].inventory = [];
  if (!guildMemory.economy[userId].stats) guildMemory.economy[userId].stats = { gambles: 0, wins: 0 };
  return guildMemory.economy[userId];
}

function leaderboard(memory) {
  return Object.entries(memory.economy || {})
    .map(([userId, user]) => ({ userId, total: Number(user.balance || 0) + Number(user.bank || 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Mort fake coin economy tools.')
    .addSubcommand((sub) => sub.setName('daily').setDescription('Claim your daily Mort coins.'))
    .addSubcommand((sub) => sub
      .setName('pay')
      .setDescription('Pay another member fake Mort coins.')
      .addUserOption((opt) => opt.setName('user').setDescription('Member to pay.').setRequired(true))
      .addIntegerOption((opt) => opt.setName('amount').setDescription('Amount of coins.').setMinValue(1).setMaxValue(100000).setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('profile')
      .setDescription('Show an economy profile.')
      .addUserOption((opt) => opt.setName('user').setDescription('Member to check.').setRequired(false)))
    .addSubcommand((sub) => sub.setName('leaderboard').setDescription('Show richest members by fake coins.'))
    .addSubcommand((sub) => sub.setName('shop').setDescription('Show the Mort shop.'))
    .addSubcommand((sub) => sub
      .setName('buy')
      .setDescription('Buy an item from the Mort shop.')
      .addStringOption((opt) => opt.setName('item').setDescription('Item ID.').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('inventory')
      .setDescription('Show your or another member inventory.')
      .addUserOption((opt) => opt.setName('user').setDescription('Member to check.').setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('gamble')
      .setDescription('Small safe coin gamble. Fake currency only.')
      .addIntegerOption((opt) => opt.setName('amount').setDescription('Coins to risk.').setMinValue(10).setMaxValue(1000).setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'daily') {
      let result;
      updateGuild(interaction.guild.id, (guild) => {
        const user = getUser(guild, interaction.user.id);
        const now = Date.now();
        if (user.lastDaily && now - user.lastDaily < DAILY_COOLDOWN) {
          result = { cooldown: DAILY_COOLDOWN - (now - user.lastDaily) };
          return;
        }
        const amount = 750 + Math.floor(Math.random() * 350);
        user.balance += amount;
        user.lastDaily = now;
        result = { amount, balance: user.balance };
      });
      if (result.cooldown) {
        const hours = Math.ceil(result.cooldown / 3600000);
        return interaction.reply({ ephemeral: true, content: `You already claimed daily. Come back in about **${hours}h**.` });
      }
      return interaction.reply({ embeds: [themedEmbed({ title: '🎁 Daily Claimed', description: `You claimed **${result.amount} coins**. Wallet: **${result.balance}**.`, color: COLORS.gold })] });
    }

    if (sub === 'pay') {
      const target = interaction.options.getUser('user', true);
      const amount = interaction.options.getInteger('amount', true);
      if (target.bot || target.id === interaction.user.id) return interaction.reply({ ephemeral: true, content: 'Pick a real member other than yourself.' });
      let ok = false;
      updateGuild(interaction.guild.id, (guild) => {
        const from = getUser(guild, interaction.user.id);
        const to = getUser(guild, target.id);
        if (from.balance < amount) return;
        from.balance -= amount;
        to.balance += amount;
        ok = true;
      });
      if (!ok) return interaction.reply({ ephemeral: true, content: 'You do not have enough wallet coins.' });
      return interaction.reply({ embeds: [themedEmbed({ title: '💸 Payment Sent', description: `<@${interaction.user.id}> paid <@${target.id}> **${amount} coins**.`, color: COLORS.success })] });
    }

    if (sub === 'profile') {
      const user = interaction.options.getUser('user') || interaction.user;
      const memory = getGuild(interaction.guild.id);
      const data = memory.economy?.[user.id] || { balance: 0, bank: 0, inventory: [], stats: {} };
      return interaction.reply({ embeds: [themedEmbed({
        title: `💰 ${user.username}'s Economy Profile`,
        description: [
          `Wallet: **${data.balance || 0} coins**`,
          `Bank: **${data.bank || 0} coins**`,
          `Total: **${(data.balance || 0) + (data.bank || 0)} coins**`,
          `Inventory items: **${data.inventory?.length || 0}**`,
          `Gamble wins: **${data.stats?.wins || 0}/${data.stats?.gambles || 0}**`
        ].join('\n'),
        color: COLORS.gold
      })] });
    }

    if (sub === 'leaderboard') {
      const rows = leaderboard(getGuild(interaction.guild.id));
      const description = rows.length ? rows.map((row, i) => `**#${i + 1}** <@${row.userId}> — **${row.total} coins**`).join('\n') : 'No economy data yet. Use `/work` or `/economy daily`.';
      return interaction.reply({ embeds: [themedEmbed({ title: '🏆 Economy Leaderboard', description, color: COLORS.gold })] });
    }

    if (sub === 'shop') {
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: '🛒 Mort Shop', description: SHOP.map((item) => `**${item.id}** — ${item.name} • **${item.price} coins**\n${item.description}`).join('\n\n'), color: COLORS.royalPurple })] });
    }

    if (sub === 'buy') {
      const id = interaction.options.getString('item', true).toLowerCase().trim();
      const item = SHOP.find((x) => x.id === id);
      if (!item) return interaction.reply({ ephemeral: true, content: 'Item not found. Run `/economy shop`.' });
      let ok = false;
      updateGuild(interaction.guild.id, (guild) => {
        const user = getUser(guild, interaction.user.id);
        if (user.balance < item.price) return;
        user.balance -= item.price;
        user.inventory.push({ id: item.id, name: item.name, boughtAt: new Date().toISOString() });
        ok = true;
      });
      if (!ok) return interaction.reply({ ephemeral: true, content: `You need **${item.price} coins** in your wallet.` });
      return interaction.reply({ embeds: [themedEmbed({ title: '✅ Item Bought', description: `You bought **${item.name}**.`, color: COLORS.success })] });
    }

    if (sub === 'inventory') {
      const user = interaction.options.getUser('user') || interaction.user;
      const memory = getGuild(interaction.guild.id);
      const inv = memory.economy?.[user.id]?.inventory || [];
      const description = inv.length ? inv.slice(-15).map((item) => `• **${item.name || item.id}**`).join('\n') : 'Inventory is empty.';
      return interaction.reply({ ephemeral: true, embeds: [themedEmbed({ title: `🎒 ${user.username}'s Inventory`, description, color: COLORS.lightBlue })] });
    }

    if (sub === 'gamble') {
      const amount = interaction.options.getInteger('amount', true);
      let result;
      updateGuild(interaction.guild.id, (guild) => {
        const user = getUser(guild, interaction.user.id);
        if (user.balance < amount) {
          result = { ok: false };
          return;
        }
        user.stats.gambles += 1;
        const win = Math.random() < 0.45;
        if (win) {
          const payout = amount;
          user.balance += payout;
          user.stats.wins += 1;
          result = { ok: true, win, payout, balance: user.balance };
        } else {
          user.balance -= amount;
          result = { ok: true, win, lost: amount, balance: user.balance };
        }
      });
      if (!result.ok) return interaction.reply({ ephemeral: true, content: 'You do not have enough wallet coins.' });
      return interaction.reply({ embeds: [themedEmbed({
        title: result.win ? '🎲 Gamble Won' : '🎲 Gamble Lost',
        description: result.win ? `You won **${result.payout} coins**. Wallet: **${result.balance}**.` : `You lost **${result.lost} coins**. Wallet: **${result.balance}**.`,
        color: result.win ? COLORS.success : COLORS.warning
      })] });
    }
  }
};
