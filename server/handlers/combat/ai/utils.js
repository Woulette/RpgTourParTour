function createAiUtils({ state, getMonsterDef, getMonsterCombatStats }) {
  const getMonsterStats = (monsterId, level = null) => {
    const def = typeof getMonsterDef === "function" ? getMonsterDef(monsterId) : null;
    if (!def) return { initiative: 0, pm: 3 };
    if (typeof getMonsterCombatStats === "function") {
      const computed = getMonsterCombatStats(def, level ?? def.baseLevel ?? 1) || {};
      return {
        initiative: Number.isFinite(computed.initiative) ? computed.initiative : 0,
        pm: Number.isFinite(computed.pm) ? computed.pm : 3,
      };
    }
    const stats = def?.statsOverrides || {};
    return {
      initiative: Number.isFinite(stats.initiative) ? stats.initiative : 0,
      pm: Number.isFinite(stats.pm) ? stats.pm : 3,
    };
  };

  const getPlayerCombatStats = (playerId) => {
    const player = Number.isInteger(playerId) ? state.players[playerId] : null;
    const initiative = Number.isFinite(player?.initiative) ? player.initiative : 0;
    const level = Number.isFinite(player?.level) ? player.level : 1;
    return {
      initiative,
      level,
    };
  };

  const isAliveMonster = (entry) => {
    if (!entry) return false;
    const hp = Number.isFinite(entry.hp) ? entry.hp : Number.isFinite(entry.hpMax) ? entry.hpMax : 0;
    return hp > 0;
  };

  const isAlivePlayer = (entry) => {
    if (!entry) return false;
    const hp = Number.isFinite(entry.hp) ? entry.hp : Number.isFinite(entry.hpMax) ? entry.hpMax : 0;
    return hp > 0;
  };

  const isAliveSummon = (entry) => {
    if (!entry) return false;
    const hp = Number.isFinite(entry.hp) ? entry.hp : Number.isFinite(entry.hpMax) ? entry.hpMax : 0;
    return hp > 0;
  };

  const getActorTieId = (actor) => {
    if (!actor) return 0;
    if (actor.kind === "joueur") {
      return Number.isInteger(actor.playerId) ? actor.playerId : 0;
    }
    if (actor.kind === "invocation") {
      return Number.isInteger(actor.summonId) ? 2000000 + actor.summonId : 2000000;
    }
    if (Number.isInteger(actor.entityId)) return Math.abs(actor.entityId);
    if (Number.isInteger(actor.combatIndex)) return 1000000 + actor.combatIndex;
    return 0;
  };

  const compareByInitLevel = (a, b) => {
    const initDiff = (b?.initiative ?? 0) - (a?.initiative ?? 0);
    if (initDiff !== 0) return initDiff;
    const lvlDiff = (b?.level ?? 1) - (a?.level ?? 1);
    if (lvlDiff !== 0) return lvlDiff;
    return getActorTieId(a) - getActorTieId(b);
  };

  const getActorKey = (actor) => {
    if (!actor) return "z:0";
    if (actor.kind === "joueur") {
      const id = Number.isInteger(actor.playerId) ? actor.playerId : 0;
      return `p:${id}`;
    }
    if (actor.kind === "invocation") {
      const id = Number.isInteger(actor.summonId) ? actor.summonId : 0;
      return `s:${id}`;
    }
    const entId = Number.isInteger(actor.entityId) ? actor.entityId : null;
    if (entId !== null) return `m:${entId}`;
    const idx = Number.isInteger(actor.combatIndex) ? actor.combatIndex : null;
    if (idx !== null) return `m:i:${idx}`;
    return "m:0";
  };

  return {
    getMonsterStats,
    getPlayerCombatStats,
    isAliveMonster,
    isAlivePlayer,
    isAliveSummon,
    compareByInitLevel,
    getActorKey,
  };
}

module.exports = {
  createAiUtils,
};
