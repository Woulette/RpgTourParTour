function createCombatHandlers(ctx) {
  const {
    state,
    broadcast,
    send,
    getNextCombatId,
    getNextEventId,
    getHostId,
    sanitizePlayerPath,
    serializeMonsterEntries,
    monsterMoveTimers,
    getSpellDef,
    isSimpleDamageSpell,
    rollSpellDamage,
  } = ctx;

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
    };
  }

  function listActiveCombats() {
    return Object.values(state.combats)
      .map((entry) => serializeCombatEntry(entry))
      .filter(Boolean);
  }

  function handleCmdMoveCombat(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    if (!player) return;
    if (!player.inCombat || !player.combatId) return;

    const combatId = Number.isInteger(msg.combatId) ? msg.combatId : player.combatId;
    if (combatId !== player.combatId) return;
    const combat = state.combats[combatId];
    if (!combat) return;
    if (combat.turn !== "player") return;
    if (
      Array.isArray(combat.participantIds) &&
      !combat.participantIds.includes(clientInfo.id)
    ) {
      return;
    }

    const mapId = typeof msg.mapId === "string" ? msg.mapId : player.mapId;
    if (player.mapId && mapId && mapId !== player.mapId) return;

    const seq = Number.isInteger(msg.seq) ? msg.seq : 0;
    if (seq <= (player.lastCombatMoveSeq || 0)) return;
    player.lastCombatMoveSeq = seq;

    let path = sanitizePlayerPath(msg.path, 32);
    if (path.length === 0) return;

    const last = path[path.length - 1];
    const toX = Number.isInteger(msg.toX) ? msg.toX : last.x;
    const toY = Number.isInteger(msg.toY) ? msg.toY : last.y;

    player.x = toX;
    player.y = toY;

    const moveCost = Number.isInteger(msg.moveCost) ? msg.moveCost : null;

    broadcast({
      t: "EvCombatMoveStart",
      combatId,
      playerId: player.id,
      mapId: player.mapId,
      seq,
      path,
      toX,
      toY,
      moveCost,
    });
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
      readyIds: [],
      phase: "prep",
      turn: "player",
      activePlayerId: participants[0],
      activePlayerIndex: 0,
      round: 1,
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
    });

    const mobEntries = collectCombatMobEntries(combatEntry);
    send(ws, {
      t: "EvCombatJoinReady",
      eventId: getNextEventId(),
      combat: serializeCombatEntry(combatEntry),
      mobEntries: serializeMonsterEntries(mobEntries),
    });
  }

  function collectCombatMobEntries(combat) {
    if (!combat || !Array.isArray(combat.mobEntityIds)) return [];
    const list = state.mapMonsters[combat.mapId];
    if (!Array.isArray(list)) return [];
    const entries = [];
    combat.mobEntityIds.forEach((entityId) => {
      const entry = list.find((m) => m && m.entityId === entityId);
      if (entry) entries.push(entry);
    });
    return entries;
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

    player.inCombat = true;
    player.combatId = combatId;

    const mobEntries = collectCombatMobEntries(combat);
    send(ws, {
      t: "EvCombatJoinReady",
      eventId: getNextEventId(),
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
      if (!Number.isInteger(combat.activePlayerId)) {
        const first = Array.isArray(combat.participantIds)
          ? Number(combat.participantIds[0])
          : null;
        if (Number.isInteger(first)) {
          combat.activePlayerId = first;
          combat.activePlayerIndex = 0;
        }
      }
      broadcast({
        t: "EvCombatTurnStarted",
        combatId,
        actorType: "player",
        activePlayerId: combat.activePlayerId ?? null,
        round: combat.round,
      });
    }
  }

  function finalizeCombat(combatId) {
    const combat = state.combats[combatId];
    if (!combat) return null;
    const mapId = combat.mapId;

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

    delete state.combats[combatId];

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
    };

    broadcast(payload);
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

  function handleCmdEndTurnCombat(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const combatId = Number.isInteger(msg.combatId) ? msg.combatId : null;
    if (!combatId) return;
    const combat = state.combats[combatId];
    if (!combat) return;
    const actorType = msg.actorType === "monster" ? "monster" : "player";
    if (combat.turn !== actorType) return;
    if (actorType === "player") {
      if (
        Array.isArray(combat.participantIds) &&
        !combat.participantIds.includes(clientInfo.id)
      ) {
        return;
      }
      if (
        Number.isInteger(combat.activePlayerId) &&
        combat.activePlayerId !== clientInfo.id
      ) {
        return;
      }
    }

    const nextTurn = actorType === "player" ? "monster" : "player";
    combat.turn = nextTurn;
    let nextActivePlayerId = combat.activePlayerId ?? null;
    if (nextTurn === "player") {
      const ids = Array.isArray(combat.participantIds) ? combat.participantIds : [];
      if (ids.length > 0) {
        let nextIndex = Number.isInteger(combat.activePlayerIndex)
          ? combat.activePlayerIndex + 1
          : 1;
        let wrapped = false;
        if (nextIndex >= ids.length) {
          nextIndex = 0;
          wrapped = true;
        }
        combat.activePlayerIndex = nextIndex;
        const candidate = Number(ids[nextIndex]);
        if (Number.isInteger(candidate)) {
          nextActivePlayerId = candidate;
        }
        if (wrapped) {
          combat.round = (combat.round || 1) + 1;
        }
      }
      combat.activePlayerId = Number.isInteger(nextActivePlayerId)
        ? nextActivePlayerId
        : combat.activePlayerId;
    }

    broadcast({
      t: "EvCombatTurnEnded",
      combatId,
      actorType,
    });
    broadcast({
      t: "EvCombatTurnStarted",
      combatId,
      actorType: nextTurn,
      activePlayerId: combat.activePlayerId ?? null,
      round: combat.round,
    });
  }

  function handleCmdCombatMonsterMoveStart(clientInfo, msg) {
    if (clientInfo.id !== getHostId()) return;
    const combatId = Number.isInteger(msg.combatId) ? msg.combatId : null;
    if (!combatId) return;
    const combat = state.combats[combatId];
    if (!combat) return;
    const entityId = Number.isInteger(msg.entityId) ? msg.entityId : null;
    const combatIndex = Number.isInteger(msg.combatIndex) ? msg.combatIndex : null;
    if (!entityId && combatIndex === null) return;
    if (
      entityId &&
      Array.isArray(combat.mobEntityIds) &&
      combat.mobEntityIds.length > 0 &&
      !combat.mobEntityIds.includes(entityId)
    ) {
      return;
    }

    const rawPath = Array.isArray(msg.path) ? msg.path : [];
    const path = rawPath
      .map((step) => ({
        x: Number.isInteger(step?.x) ? step.x : null,
        y: Number.isInteger(step?.y) ? step.y : null,
      }))
      .filter((step) => step.x !== null && step.y !== null);
    if (path.length === 0) return;

    const seq = Number.isInteger(msg.seq) ? msg.seq : 0;
    const mapId = combat.mapId || null;

    broadcast({
      t: "EvCombatMonsterMoveStart",
      combatId,
      mapId,
      entityId,
      combatIndex,
      seq,
      path,
    });
  }

  function handleCmdCastSpell(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    if (!msg.spellId) return;

    const player = state.players[clientInfo.id];
    let combatId = null;
    let authoritative = false;
    let damagePayload = null;
    if (player && player.inCombat) {
      const combat = player.combatId ? state.combats[player.combatId] : null;
      if (!combat) return;
      if (combat.turn !== "player") return;
      if (
        Array.isArray(combat.participantIds) &&
        !combat.participantIds.includes(clientInfo.id)
      ) {
        return;
      }
      combatId = combat.id;

      const spellDef = getSpellDef(msg.spellId);
      const targetX = Number.isInteger(msg.targetX) ? msg.targetX : null;
      const targetY = Number.isInteger(msg.targetY) ? msg.targetY : null;
      if (spellDef && isSimpleDamageSpell(spellDef) && targetX !== null && targetY !== null) {
        authoritative = true;
        const damage = rollSpellDamage(spellDef);
        damagePayload = {
          t: "EvDamageApplied",
          combatId,
          casterId: clientInfo.id,
          spellId: msg.spellId,
          targetX,
          targetY,
          damage,
        };
      }
    }

    broadcast({
      t: "EvSpellCast",
      combatId,
      authoritative,
      casterId: clientInfo.id,
      spellId: msg.spellId,
      targetX: msg.targetX ?? null,
      targetY: msg.targetY ?? null,
      targetId: msg.targetId ?? null,
    });

    if (damagePayload) {
      broadcast(damagePayload);
    }
  }

  function handleCmdCombatDamageApplied(clientInfo, msg) {
    if (clientInfo.id !== getHostId()) return;
    const combatId = Number.isInteger(msg.combatId) ? msg.combatId : null;
    if (!combatId) return;
    const combat = state.combats[combatId];
    if (!combat) return;
    const damage = Number.isFinite(msg.damage) ? Math.max(0, msg.damage) : 0;
    if (damage <= 0) return;
    const targetX = Number.isInteger(msg.targetX) ? msg.targetX : null;
    const targetY = Number.isInteger(msg.targetY) ? msg.targetY : null;
    if (targetX === null || targetY === null) return;

    broadcast({
      t: "EvDamageApplied",
      combatId,
      casterId: msg.casterId ?? null,
      spellId: msg.spellId ?? null,
      targetX,
      targetY,
      damage,
      source: msg.source ?? "monster",
    });
  }

  function handleCmdCombatState(clientInfo, msg) {
    if (clientInfo.id !== getHostId()) return;
    const combatId = Number.isInteger(msg.combatId) ? msg.combatId : null;
    if (!combatId) return;
    const combat = state.combats[combatId];
    if (!combat) return;
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (!mapId || mapId !== combat.mapId) return;

    const players = Array.isArray(msg.players) ? msg.players : [];
    const monsters = Array.isArray(msg.monsters) ? msg.monsters : [];

    broadcast({
      t: "EvCombatState",
      combatId,
      mapId,
      players,
      monsters,
    });
  }

  return {
    serializeCombatEntry,
    listActiveCombats,
    handleCmdMoveCombat,
    handleCmdCombatStart,
    handleCmdJoinCombat,
    handleCmdCombatReady,
    handleCmdCombatEnd,
    handleCmdEndTurnCombat,
    handleCmdCombatMonsterMoveStart,
    handleCmdCastSpell,
    handleCmdCombatDamageApplied,
    handleCmdCombatState,
    finalizeCombat,
  };
}

module.exports = {
  createCombatHandlers,
};
