function createStateHandlers(ctx, helpers) {
  const {
    state,
    broadcast,
    send,
    getNextCombatId,
    getNextEventId,
    monsterMoveTimers,
    serializeMonsterEntries,
    serializeActorOrder,
  } = ctx;
  const {
    collectCombatMobEntries,
    ensureCombatSnapshot,
    applyCombatPlacement,
    upsertSnapshotPlayer,
    buildCombatActorOrder,
    runMonsterAiTurn,
    advanceCombatTurn,
  } = helpers;

  function serializeCombatEntry(entry) {
    if (!entry || !Number.isInteger(entry.id)) return null;
    return {
      combatId: entry.id,
      mapId: entry.mapId || null,
      tileX: Number.isInteger(entry.tileX) ? entry.tileX : null,
      tileY: Number.isInteger(entry.tileY) ? entry.tileY : null,
      participantIds: Array.isArray(entry.participantIds)
        ? entry.participantIds.slice()
        : [],
      mobEntityIds: Array.isArray(entry.mobEntityIds)
        ? entry.mobEntityIds.slice()
        : [],
      readyIds: Array.isArray(entry.readyIds) ? entry.readyIds.slice() : [],
      phase: entry.phase || null,
      turn: entry.turn || null,
      round: Number.isInteger(entry.round) ? entry.round : null,
      activePlayerId: Number.isInteger(entry.activePlayerId)
        ? entry.activePlayerId
        : null,
      activeMonsterId: Number.isInteger(entry.activeMonsterId)
        ? entry.activeMonsterId
        : null,
      activeMonsterIndex: Number.isInteger(entry.activeMonsterIndex)
        ? entry.activeMonsterIndex
        : null,
      aiDriverId: Number.isInteger(entry.aiDriverId) ? entry.aiDriverId : null,
    };
  }

  function listActiveCombats() {
    return Object.values(state.combats)
      .map((entry) => serializeCombatEntry(entry))
      .filter(Boolean);
  }

  function handleCmdCombatStart(ws, clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    if (!player) return;
    if (player.inCombat) return;
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (!mapId) return;
    if (player.mapId !== mapId) return;

    const requestedIds = Array.isArray(msg.participantIds) ? msg.participantIds : [];
    const candidateIds = [clientInfo.id, ...requestedIds];
    const participants = [];
    const seen = new Set();
    candidateIds.forEach((raw) => {
      const id = Number(raw);
      if (!Number.isInteger(id)) return;
      if (seen.has(id)) return;
      const p = state.players[id];
      if (!p || p.inCombat) return;
      if (p.mapId !== mapId) return;
      seen.add(id);
      participants.push(id);
    });
    if (participants.length === 0) return;

    const list = state.mapMonsters[mapId];
    const requestedMobs = Array.isArray(msg.mobEntityIds) ? msg.mobEntityIds : [];
    const mobEntityIds = [];
    const mobLimit = 20;
    if (Array.isArray(list)) {
      for (const raw of requestedMobs) {
        if (mobEntityIds.length >= mobLimit) break;
        const entityId = Number(raw);
        if (!Number.isInteger(entityId)) continue;
        if (mobEntityIds.includes(entityId)) continue;
        const entry = list.find((m) => m && m.entityId === entityId);
        if (!entry || entry.inCombat) continue;
        mobEntityIds.push(entityId);
      }
    }

    let originTileX = null;
    let originTileY = null;
    if (Array.isArray(list) && mobEntityIds.length > 0) {
      const leaderId = mobEntityIds[0];
      const leaderEntry = list.find((m) => m && m.entityId === leaderId);
      if (leaderEntry) {
        originTileX = Number.isInteger(leaderEntry.tileX) ? leaderEntry.tileX : null;
        originTileY = Number.isInteger(leaderEntry.tileY) ? leaderEntry.tileY : null;
      }
    }
    if (originTileX === null || originTileY === null) {
      originTileX = Number.isInteger(player.x) ? player.x : null;
      originTileY = Number.isInteger(player.y) ? player.y : null;
    }

    const combatId = getNextCombatId();
    const combatEntry = {
      id: combatId,
      mapId,
      tileX: originTileX,
      tileY: originTileY,
      participantIds: participants.slice(),
      mobEntityIds: mobEntityIds.slice(),
      mobEntries: [],
      readyIds: [],
      phase: "prep",
      turn: null,
      activePlayerId: null,
      round: 1,
      aiDriverId: participants[0],
      pmRemainingByPlayer: {},
      createdAt: Date.now(),
    };
    state.combats[combatId] = combatEntry;

    participants.forEach((id) => {
      const p = state.players[id];
      if (!p) return;
      p.inCombat = true;
      p.combatId = combatId;
    });

    if (Array.isArray(list)) {
      mobEntityIds.forEach((entityId) => {
        const entry = list.find((m) => m && m.entityId === entityId);
        if (!entry) return;
        entry.inCombat = true;
        entry.combatId = combatId;
        entry.isMoving = false;
        entry.moveEndAt = 0;
        entry.nextRoamAt = 0;
        const moveTimer = monsterMoveTimers.get(entityId);
        if (moveTimer) {
          clearTimeout(moveTimer);
          monsterMoveTimers.delete(entityId);
        }
      });
    }

    broadcast({
      t: "EvCombatCreated",
      combatId,
      mapId,
      tileX: combatEntry.tileX,
      tileY: combatEntry.tileY,
      participantIds: participants.slice(),
      mobEntityIds: mobEntityIds.slice(),
      phase: combatEntry.phase,
      turn: combatEntry.turn,
      round: combatEntry.round,
      activePlayerId: combatEntry.activePlayerId ?? null,
      aiDriverId: combatEntry.aiDriverId ?? null,
    });

    const mobEntries = collectCombatMobEntries(combatEntry);
    combatEntry.mobEntries = mobEntries.slice();
    ensureCombatSnapshot(combatEntry);
    broadcast({
      t: "EvCombatJoinReady",
      combat: serializeCombatEntry(combatEntry),
      mobEntries: serializeMonsterEntries(mobEntries),
    });
  }

  function handleCmdJoinCombat(ws, clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const combatId = Number.isInteger(msg.combatId) ? msg.combatId : null;
    if (!combatId) return;
    const player = state.players[clientInfo.id];
    if (!player || player.inCombat) return;
    const combat = state.combats[combatId];
    if (!combat) return;
    if (combat.phase !== "prep") return;
    if (player.mapId !== combat.mapId) return;

    if (!Array.isArray(combat.participantIds)) {
      combat.participantIds = [];
    }
    if (!combat.participantIds.includes(clientInfo.id)) {
      combat.participantIds.push(clientInfo.id);
    }
    if (!Number.isInteger(combat.aiDriverId)) {
      const first = Array.isArray(combat.participantIds)
        ? Number(combat.participantIds[0])
        : null;
      if (Number.isInteger(first)) {
        combat.aiDriverId = first;
      }
    }

    player.inCombat = true;
    player.combatId = combatId;
    upsertSnapshotPlayer(combat, player.id);

    const mobEntries = collectCombatMobEntries(combat);
    broadcast({
      t: "EvCombatJoinReady",
      combat: serializeCombatEntry(combat),
      mobEntries: serializeMonsterEntries(mobEntries),
    });

    broadcast({ t: "EvCombatUpdated", ...serializeCombatEntry(combat) });
  }

  function handleCmdCombatReady(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const combatId = Number.isInteger(msg.combatId) ? msg.combatId : null;
    if (!combatId) return;
    const combat = state.combats[combatId];
    if (!combat) return;
    if (!Array.isArray(combat.participantIds)) return;
    if (!combat.participantIds.includes(clientInfo.id)) return;
    if (combat.phase !== "prep") return;

    const player = state.players[clientInfo.id];
    if (player) {
      if (Number.isFinite(msg.initiative)) {
        player.initiative = Math.max(0, Math.round(msg.initiative));
      }
      if (Number.isFinite(msg.level)) {
        player.level = Math.max(1, Math.round(msg.level));
      }
      if (typeof msg.classId === "string" && msg.classId) {
        player.classId = msg.classId;
      }
      if (typeof msg.displayName === "string" && msg.displayName) {
        player.displayName = msg.displayName;
      }
    }

    combat.readyIds = Array.isArray(combat.readyIds) ? combat.readyIds : [];
    if (!combat.readyIds.includes(clientInfo.id)) {
      combat.readyIds.push(clientInfo.id);
    }

    const prevPhase = combat.phase;
    const allReady = combat.participantIds.every((id) => combat.readyIds.includes(id));
    if (allReady) {
      combat.phase = "combat";
    }
    // eslint-disable-next-line no-console
    console.log("[LAN] CmdCombatReady", {
      combatId,
      playerId: clientInfo.id,
      mapId: combat.mapId,
      phase: combat.phase,
      participants: combat.participantIds,
      readyIds: combat.readyIds,
    });

    broadcast({ t: "EvCombatUpdated", ...serializeCombatEntry(combat) });

    if (allReady && prevPhase !== "combat") {
      ensureCombatSnapshot(combat);
      applyCombatPlacement(combat);
      combat.stateSnapshotLocked = true;
      combat.pmRemainingByPlayer = combat.pmRemainingByPlayer || {};
      combat.participantIds.forEach((id) => {
        const p = state.players[id];
        if (!p) return;
        combat.pmRemainingByPlayer[id] = Number.isFinite(p.pm) ? p.pm : 3;
      });
      const order = buildCombatActorOrder(combat);
      combat.actorIndex = 0;
      const firstActor = Array.isArray(order) ? order[0] : null;
      if (firstActor?.kind === "monstre") {
        combat.turn = "monster";
        combat.activePlayerId = null;
        combat.activeMonsterId = Number.isInteger(firstActor.entityId)
          ? firstActor.entityId
          : null;
        combat.activeMonsterIndex = Number.isInteger(firstActor.combatIndex)
          ? firstActor.combatIndex
          : null;
      } else if (firstActor?.kind === "joueur") {
        combat.turn = "player";
        combat.activePlayerId = Number.isInteger(firstActor.playerId)
          ? firstActor.playerId
          : null;
        combat.activeMonsterId = null;
        combat.activeMonsterIndex = null;
      }
      broadcast({
        t: "EvCombatTurnStarted",
        combatId,
        actorType: combat.turn === "monster" ? "monster" : "player",
        activePlayerId: combat.activePlayerId ?? null,
        activeMonsterId: combat.activeMonsterId ?? null,
        activeMonsterIndex: combat.activeMonsterIndex ?? null,
        round: combat.round,
        actorOrder: serializeActorOrder ? serializeActorOrder(combat) : undefined,
      });
      if (combat.turn === "monster" && typeof runMonsterAiTurn === "function") {
        runMonsterAiTurn(combat, () => {
          if (typeof advanceCombatTurn === "function") {
            advanceCombatTurn(combat, "monster");
          }
        });
      }
      if (combat.stateSnapshot) {
        broadcast({
          t: "EvCombatState",
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
          actorOrder: serializeActorOrder ? serializeActorOrder(combat) : undefined,
          players: Array.isArray(combat.stateSnapshot.players)
            ? combat.stateSnapshot.players
            : [],
          monsters: Array.isArray(combat.stateSnapshot.monsters)
            ? combat.stateSnapshot.monsters
            : [],
        });
      }
    }
  }

  function finalizeCombat(combatId) {
    const combat = state.combats[combatId];
    if (!combat) return null;
    const mapId = combat.mapId;
    if (combat.aiTimer) {
      clearTimeout(combat.aiTimer);
      combat.aiTimer = null;
    }

    combat.participantIds.forEach((id) => {
      const p = state.players[id];
      if (!p) return;
      if (p.combatId === combatId) {
        p.inCombat = false;
        p.combatId = null;
      }
    });

    const list = state.mapMonsters[mapId];
    if (Array.isArray(list)) {
      list.forEach((entry) => {
        if (!entry) return;
        if (entry.combatId === combatId) {
          entry.inCombat = false;
          entry.combatId = null;
        }
      });
    }

    combat.combatSeq = Number.isInteger(combat.combatSeq) ? combat.combatSeq + 1 : 1;
    const payload = {
      t: "EvCombatEnded",
      combatId,
      mapId,
      participantIds: Array.isArray(combat.participantIds)
        ? combat.participantIds.slice()
        : [],
      mobEntityIds: Array.isArray(combat.mobEntityIds)
        ? combat.mobEntityIds.slice()
        : [],
      combatSeq: combat.combatSeq,
    };

    broadcast(payload);
    delete state.combats[combatId];
    return payload;
  }

  function handleCmdCombatEnd(ws, clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const combatId = Number.isInteger(msg.combatId) ? msg.combatId : null;
    if (!combatId) return;
    const combat = state.combats[combatId];
    if (!combat) return;
    if (!Array.isArray(combat.participantIds)) return;
    if (!combat.participantIds.includes(clientInfo.id)) return;
    finalizeCombat(combatId);
  }

  return {
    serializeCombatEntry,
    listActiveCombats,
    handleCmdCombatStart,
    handleCmdJoinCombat,
    handleCmdCombatReady,
    handleCmdCombatEnd,
    finalizeCombat,
  };
}

module.exports = {
  createStateHandlers,
};
