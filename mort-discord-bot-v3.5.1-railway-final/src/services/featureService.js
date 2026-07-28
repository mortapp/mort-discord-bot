const { FEATURE_CATALOG, FEATURE_CATEGORIES } = require('../config/featureCatalog');
const { getGuild, updateGuild } = require('./dataStore');

function stats(guildId) {
  const memory = getGuild(guildId);
  const toggles = memory.featureToggles || {};
  const enabled = Object.values(toggles).filter(Boolean).length;
  const byStatus = FEATURE_CATALOG.reduce((acc, feature) => {
    acc[feature.status] = (acc[feature.status] || 0) + 1;
    return acc;
  }, {});
  return {
    total: FEATURE_CATALOG.length,
    categories: FEATURE_CATEGORIES.length,
    enabled,
    byStatus
  };
}

function searchFeatures(query, limit = 10) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return FEATURE_CATALOG.slice(0, limit);
  return FEATURE_CATALOG.filter((feature) => (
    feature.id.toLowerCase().includes(q)
    || feature.category.toLowerCase().includes(q)
    || feature.categoryName.toLowerCase().includes(q)
    || feature.name.toLowerCase().includes(q)
    || feature.summary.toLowerCase().includes(q)
  )).slice(0, limit);
}

function listByCategory(category, page = 1, pageSize = 10) {
  const normalized = String(category || '').toLowerCase().trim();
  const matches = FEATURE_CATALOG.filter((feature) => feature.category.toLowerCase() === normalized || feature.categoryName.toLowerCase().includes(normalized));
  const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  return {
    features: matches.slice((safePage - 1) * pageSize, safePage * pageSize),
    total: matches.length,
    page: safePage,
    totalPages
  };
}

function setFeature(guildId, id, enabled) {
  const feature = FEATURE_CATALOG.find((item) => item.id.toLowerCase() === String(id).toLowerCase());
  if (!feature) return { ok: false, feature: null };
  updateGuild(guildId, (guild) => {
    guild.featureToggles = guild.featureToggles || {};
    guild.featureToggles[feature.id] = Boolean(enabled);
  });
  return { ok: true, feature };
}

function randomFeatures(count = 5) {
  return [...FEATURE_CATALOG].sort(() => Math.random() - 0.5).slice(0, count);
}

module.exports = {
  FEATURE_CATALOG,
  FEATURE_CATEGORIES,
  stats,
  searchFeatures,
  listByCategory,
  setFeature,
  randomFeatures
};
