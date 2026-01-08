function createCombatChecksumHandlers(ctx, helpers) {
  const { state, send, debugLog, getNextEventId, serializeActorOrder } = ctx;
  const { ensureCombatSnapshot } = helpers;

  const hashString = (value) => {
    const str = String(value);
    let hash = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  const encodeNum = (value, fallback = 0) =>
    Number.isFinite(value) ? Math.round(value) : fallback;

  const buildCombatChecksum = (combat) => {
    if (!combat) return 0;
    const snapshot = ensureCombatSnapshot(combat);
    if (!snapshot) return 0;

    const parts = [];
    const turnValue = combat.turn === "monster" || combat.turn === "summon" ? 2 : 1;
    parts.push(
      turnValue,
      encodeNum(combat.round, 0),
      encodeNum(combat.activePlayerId, 0),
      encodeNum(combat.activeMonsterId, 0),
      encodeNum(combat.activeMonsterIndex, -1),
      encodeNum(combat.actorIndex, -1)
    );

    const players = Array.isArray(snapshot.players) ? snapshot.players.slice() : [];
    players.sort((a, b) => {
      const ia = Number.isInteger(a?.playerId) ? a.playerId : 0;
      const ib = Number.isInteger(b?.playerId) ? b.playerId : 0;
      return ia - ib;
    });
    players.forEach((p) => {
      parts.push(
        encodeNum(p?.playerId, 0),
        encodeNum(p?.tileX, -1),
        encodeNum(p?.tileY, -1),
        encodeNum(p?.hp, 0),
        encodeNum(p?.hpMax, 0)
      );
    });

    parts.push(999999);

    const monsters = Array.isArray(snapshot.monsters) ? snapshot.monsters.slice() : [];
    monsters.sort((a, b) => {
      const ka = Number.isInteger(a?.entityId)
        ? a.entityId
        : Number.isInteger(a?.combatIndex)
          ? 1000000 + a.combatIndex
          : 0;
      const kb = Number.isInteger(b?.entityId)
        ? b.entityId
        : Number.isInteger(b?.combatIndex)
          ? 1000000 + b.combatIndex
          : 0;
      return ka - kb;
    });
    monsters.forEach((m) => {
      const key = Number.isInteger(m?.entityId)
        ? m.entityId
        : Number.isInteger(m?.combatIndex)
          ? 1000000 + m.combatIndex
          : 0;
      parts.push(
        encodeNum(key, 0),
        encodeNum(m?.tileX, -1),
        encodeNum(m?.tileY, -1),
        encodeNum(m?.hp, 0),
        encodeNum(m?.hpMax, 0)
      );
    });

    parts.push(777777);

    const summons = Array.isArray(snapshot.summons) ? snapshot.summons.slice() : [];
    summons.sort((a, b) => {
      const ia = Number.isInteger(a?.summonId) ? a.summonId : 0;
      const ib = Number.isInteger(b?.summonId) ? b.summonId : 0;
      return ia - ib;
    });
    summons.forEach((s) => {
      parts.push(
        encodeNum(s?.summonId, 0),
        encodeNum(s?.tileX, -1),
        encodeNum(s?.tileY, -1),
        encodeNum(s?.hp, 0),
        encodeNum(s?.hpMax, 0)
      );
    });

    return hashString(parts.join("|"));
  };

  function handleCmdCombatChecksum(ws, clientInfo, msg) {
    if (!clientInfo || !Number.isInteger(clientInfo.id)) return;
    const player = state.players[clientInfo.id];
    if (!player || !player.inCombat || !player.combatId) return;
    const combatId = Number.isInteger(msg.combatId) ? msg.combatId : player.combatId;
    if (!combatId || combatId !== player.combatId) return;
    const combat = state.combats[combatId];
    if (!combat) return;
    if (combat.phase !== "combat") return;

    const clientHash = Number.isInteger(msg.hash) ? msg.hash : null;
    if (clientHash === null) return;
    const serverHash = buildCombatChecksum(combat);

    if (clientHash !== serverHash) {
      debugLog("Checksum mismatch -> resync", {
        combatId,
        playerId: clientInfo.id,
        clientHash,
        serverHash,
      });
      if (combat.stateSnapshot) {
        send(ws, {
          t: "EvCombatState",
          eventId: typeof getNextEventId === "function" ? getNextEventId() : undefined,
          combatId,
          mapId: combat.mapId || null,
          turn: combat.turn || null,
          round: Number.isInteger(combat.round) ? combat.round : null,
          activePlayerId: Number.isInteger(combat.activePlayerId)
            ? combat.activePlayerId
            : null,
          activeMonsterId: Number.isInteger(combat.activeMonsterId)
            ? combat.activeMonsterId
            : null,
          activeMonsterIndex: Number.isInteger(combat.activeMonsterIndex)
            ? combat.activeMonsterIndex
            : null,
          activeSummonId: Number.isInteger(combat.activeSummonId)
            ? combat.activeSummonId
            : null,
          actorOrder: serializeActorOrder ? serializeActorOrder(combat) : undefined,
          players: Array.isArray(combat.stateSnapshot.players)
            ? combat.stateSnapshot.players
            : [],
          monsters: Array.isArray(combat.stateSnapshot.monsters)
            ? combat.stateSnapshot.monsters
            : [],
          summons: Array.isArray(combat.stateSnapshot.summons)
            ? combat.stateSnapshot.summons
            : [],
          resync: true,
        });
      }
    }
  }

  return {
    buildCombatChecksum,
    handleCmdCombatChecksum,
  };
}

module.exports = {
  createCombatChecksumHandlers,
};
