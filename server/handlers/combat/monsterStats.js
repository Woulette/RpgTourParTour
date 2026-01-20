function computeScaledMonsterOverrides(def, level) {
  if (!def) return {};
  const overrides = def.statsOverrides || {};

  const baseLevel = typeof def.baseLevel === "number" ? def.baseLevel : 1;
  const safeLevel =
    typeof level === "number" && Number.isFinite(level) ? level : baseLevel;
  const delta = Math.max(0, safeLevel - baseLevel);
  if (!overrides || delta <= 0) return overrides;

  const HP_PCT_PER_LEVEL = 0.08;
  const HP_CAP_PER_LEVEL = 40;
  const STAT_PCT_PER_LEVEL = 0.05;
  const STAT_CAP_PER_LEVEL = 10;
  const STAT_MIN_PER_LEVEL = 1;

  const result = { ...overrides };

  const baseHp =
    typeof overrides.hpMax === "number"
      ? overrides.hpMax
      : typeof overrides.hp === "number"
        ? overrides.hp
        : null;

  if (typeof baseHp === "number") {
    const perLevel = Math.min(
      HP_CAP_PER_LEVEL,
      Math.max(1, Math.round(baseHp * HP_PCT_PER_LEVEL))
    );
    const scaledHpMax = baseHp + perLevel * delta;
    result.hpMax = scaledHpMax;
    result.hp = scaledHpMax;
  }

  const scalableKeys = [
    "force",
    "intelligence",
    "agilite",
    "chance",
    "vitalite",
    "sagesse",
  ];
  scalableKeys.forEach((key) => {
    const baseVal = overrides[key];
    if (typeof baseVal !== "number") return;
    const perLevel = Math.min(
      STAT_CAP_PER_LEVEL,
      Math.max(STAT_MIN_PER_LEVEL, Math.round(baseVal * STAT_PCT_PER_LEVEL))
    );
    result[key] = baseVal + perLevel * delta;
  });

  return result;
}

function buildMonsterStats(def, level, statsApi) {
  if (!def || !statsApi?.createStats) return null;
  const overrides = computeScaledMonsterOverrides(def, level);
  const stats = statsApi.createStats(overrides, { applySecondaryStats: false });
  return stats;
}

module.exports = {
  computeScaledMonsterOverrides,
  buildMonsterStats,
};
