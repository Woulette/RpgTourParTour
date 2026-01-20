function createAiOrder({
  state,
  ensureCombatSnapshot,
  getMonsterStats,
  getPlayerCombatStats,
  isAlivePlayer,
  isAliveMonster,
  isAliveSummon,
  compareByInitLevel,
  getActorKey,
}) {
  const buildCombatActorOrder = (combat) => {
    if (!combat) return [];
    const snapshot = ensureCombatSnapshot(combat);
    if (!snapshot) return [];

    const alivePlayers = (Array.isArray(snapshot.players) ? snapshot.players : [])
      .filter((p) => isAlivePlayer(p))
      .map((p) => {
        const stats = getPlayerCombatStats(p.playerId);
        return {
          kind: "joueur",
          playerId: p.playerId,
          initiative: stats.initiative,
          level: stats.level,
        };
      });

    const aliveSummons = (Array.isArray(snapshot.summons) ? snapshot.summons : [])
      .filter((s) => isAliveSummon(s))
      .map((s) => {
        const stats = getMonsterStats(s.monsterId, s.level ?? null);
        return {
          kind: "invocation",
          summonId: Number.isInteger(s.summonId) ? s.summonId : null,
          ownerPlayerId: Number.isInteger(s.ownerPlayerId) ? s.ownerPlayerId : null,
          monsterId: s.monsterId || null,
          initiative: stats.initiative,
          level: Number.isFinite(s.level) ? s.level : 1,
        };
      });

    const mobEntries = Array.isArray(combat.mobEntries) ? combat.mobEntries : [];
    const mobLevelMap = new Map();
    mobEntries.forEach((m, idx) => {
      if (!m) return;
      if (Number.isInteger(m.entityId)) {
        mobLevelMap.set(`id:${m.entityId}`, m.level);
      }
      const cIdx = Number.isInteger(m.combatIndex) ? m.combatIndex : idx;
      if (Number.isInteger(cIdx)) {
        mobLevelMap.set(`idx:${cIdx}`, m.level);
      }
    });
    const aliveMonsters = (Array.isArray(snapshot.monsters) ? snapshot.monsters : [])
      .filter((m) => isAliveMonster(m))
      .map((m, idx) => {
        const stats = getMonsterStats(m.monsterId);
        const level =
          (Number.isInteger(m.entityId)
            ? mobLevelMap.get(`id:${m.entityId}`)
            : null) ??
          (Number.isInteger(m.combatIndex)
            ? mobLevelMap.get(`idx:${m.combatIndex}`)
            : null) ??
          1;
        return {
          kind: "monstre",
          entityId: Number.isInteger(m.entityId) ? m.entityId : null,
          combatIndex: Number.isInteger(m.combatIndex) ? m.combatIndex : idx,
          monsterId: m.monsterId || null,
          initiative: stats.initiative,
          level: Number.isFinite(level) ? level : 1,
        };
      });

    const sortedPlayers = alivePlayers.slice().sort(compareByInitLevel);
    const sortedMonsters = aliveMonsters.slice().sort(compareByInitLevel);
    const summonsByOwner = new Map();
    aliveSummons.forEach((s) => {
      if (!Number.isInteger(s.ownerPlayerId)) return;
      const list = summonsByOwner.get(s.ownerPlayerId) || [];
      list.push(s);
      summonsByOwner.set(s.ownerPlayerId, list);
    });
    summonsByOwner.forEach((list, key) => {
      list.sort(compareByInitLevel);
      summonsByOwner.set(key, list);
    });

    if (Array.isArray(combat.actorOrder) && combat.actorOrder.length > 0) {
      const aliveKeys = new Set();
      sortedPlayers.forEach((p) => aliveKeys.add(getActorKey(p)));
      sortedMonsters.forEach((m) => aliveKeys.add(getActorKey(m)));
      aliveSummons.forEach((s) => aliveKeys.add(getActorKey(s)));

      const kept = [];
      const seen = new Set();
      const appendSummonsForOwner = (playerId) => {
        const summons = summonsByOwner.get(playerId) || [];
        summons.forEach((s) => {
          const sKey = getActorKey(s);
          if (seen.has(sKey)) return;
          seen.add(sKey);
          kept.push(s);
        });
      };

      combat.actorOrder.forEach((actor) => {
        if (!actor) return;
        if (actor.kind === "invocation") {
          return;
        }
        const key = getActorKey(actor);
        if (!aliveKeys.has(key)) return;
        if (!seen.has(key)) {
          seen.add(key);
          kept.push(actor);
        }
        if (actor.kind === "joueur") {
          appendSummonsForOwner(actor.playerId);
        }
      });

      sortedPlayers.forEach((actor) => {
        const key = getActorKey(actor);
        if (!seen.has(key)) {
          seen.add(key);
          kept.push(actor);
        }
        appendSummonsForOwner(actor.playerId);
      });
      sortedMonsters.forEach((actor) => {
        const key = getActorKey(actor);
        if (seen.has(key)) return;
        seen.add(key);
        kept.push(actor);
      });
      aliveSummons.forEach((s) => {
        const sKey = getActorKey(s);
        if (seen.has(sKey)) return;
        seen.add(sKey);
        kept.push(s);
      });

      combat.actorOrder = kept;
      return kept;
    }

    const players = sortedPlayers;
    const monsters = sortedMonsters;

    const actors = [];
    let pIdx = 0;
    let mIdx = 0;
    let nextSide = "joueur";
    if (players.length === 0 && monsters.length > 0) {
      nextSide = "monstre";
    } else if (players.length > 0 && monsters.length > 0) {
      nextSide = compareByInitLevel(players[0], monsters[0]) <= 0 ? "joueur" : "monstre";
    }
    while (pIdx < players.length || mIdx < monsters.length) {
      if (nextSide === "joueur" && pIdx < players.length) {
        const playerActor = players[pIdx];
        actors.push(playerActor);
        const summons = summonsByOwner.get(playerActor.playerId) || [];
        summons.forEach((s) => actors.push(s));
        pIdx += 1;
        nextSide = "monstre";
        continue;
      }
      if (nextSide === "monstre" && mIdx < monsters.length) {
        actors.push(monsters[mIdx]);
        mIdx += 1;
        nextSide = "joueur";
        continue;
      }
      if (pIdx < players.length) {
        actors.push(players[pIdx]);
        pIdx += 1;
      } else if (mIdx < monsters.length) {
        actors.push(monsters[mIdx]);
        mIdx += 1;
      } else {
        break;
      }
    }

    combat.actorOrder = actors;
    return actors;
  };

  return {
    buildCombatActorOrder,
  };
}

module.exports = {
  createAiOrder,
};
