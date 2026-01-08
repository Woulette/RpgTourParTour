function createCombatMobHelpers(ctx) {
  const { state } = ctx;

  function buildCombatMobEntries(combat, leaderEntry) {
    if (!combat || !leaderEntry) return [];
    const monsterId = leaderEntry.monsterId;
    if (!monsterId) return [];
    const groupMonsterIds = Array.isArray(leaderEntry.groupMonsterIds)
      ? leaderEntry.groupMonsterIds
      : [monsterId];
    const groupLevels = Array.isArray(leaderEntry.groupLevels)
      ? leaderEntry.groupLevels
      : [];
    const groupSize =
      Number.isInteger(leaderEntry.groupSize) && leaderEntry.groupSize > 0
        ? leaderEntry.groupSize
        : groupMonsterIds.length || 1;

    const entries = [];
    for (let i = 0; i < groupSize; i += 1) {
      const memberId = groupMonsterIds[i] || monsterId;
      const memberLevel =
        Number.isInteger(groupLevels[i]) ? groupLevels[i] : leaderEntry.level ?? null;
      const entityId =
        i === 0
          ? Number.isInteger(leaderEntry.entityId)
            ? leaderEntry.entityId
            : null
          : -((combat.id || 0) * 1000 + (i + 1));
      entries.push({
        entityId,
        monsterId: memberId,
        tileX: Number.isInteger(leaderEntry.tileX) ? leaderEntry.tileX : null,
        tileY: Number.isInteger(leaderEntry.tileY) ? leaderEntry.tileY : null,
        groupId: Number.isInteger(leaderEntry.groupId) ? leaderEntry.groupId : null,
        groupSize,
        groupMonsterIds: groupMonsterIds.slice(),
        groupLevels: groupLevels.length > 0 ? groupLevels.slice() : null,
        groupLevelTotal: Number.isInteger(leaderEntry.groupLevelTotal)
          ? leaderEntry.groupLevelTotal
          : null,
        level: Number.isInteger(memberLevel) ? memberLevel : leaderEntry.level ?? null,
        respawnTemplate:
          leaderEntry.respawnTemplate && typeof leaderEntry.respawnTemplate === "object"
            ? {
                groupPool: Array.isArray(leaderEntry.respawnTemplate.groupPool)
                  ? leaderEntry.respawnTemplate.groupPool.slice()
                  : [],
                groupSizeMin: Number.isInteger(leaderEntry.respawnTemplate.groupSizeMin)
                  ? leaderEntry.respawnTemplate.groupSizeMin
                  : null,
                groupSizeMax: Number.isInteger(leaderEntry.respawnTemplate.groupSizeMax)
                  ? leaderEntry.respawnTemplate.groupSizeMax
                  : null,
                forceMixedGroup: leaderEntry.respawnTemplate.forceMixedGroup === true,
              }
            : null,
        spawnMapKey: typeof leaderEntry.spawnMapKey === "string" ? leaderEntry.spawnMapKey : null,
        combatIndex: i,
      });
    }

    return entries;
  }

  function collectCombatMobEntries(combat) {
    if (!combat || !Array.isArray(combat.mobEntityIds)) return [];
    if (Array.isArray(combat.mobEntries) && combat.mobEntries.length > 0) {
      return combat.mobEntries.slice();
    }
    const list = state.mapMonsters[combat.mapId];
    if (!Array.isArray(list)) return [];
    const entries = [];
    combat.mobEntityIds.forEach((entityId) => {
      const entry = list.find((m) => m && m.entityId === entityId);
      if (!entry) return;
      const expanded = buildCombatMobEntries(combat, entry);
      if (expanded.length > 0) {
        entries.push(...expanded);
      } else {
        entries.push(entry);
      }
    });
    combat.mobEntries = entries.slice();
    return entries;
  }

  return {
    buildCombatMobEntries,
    collectCombatMobEntries,
  };
}

module.exports = {
  createCombatMobHelpers,
};
