function createMoveHandlers(ctx, helpers) {
  const { state, broadcast, sanitizePlayerPath, getMonsterDef } = ctx;
  const {
    upsertSnapshotPlayer,
    upsertSnapshotMonster,
    ensureCombatSnapshot,
    resolveCombatPlacement,
  } = helpers;

  const getDerivedTacle = (stats) => {
    if (!stats) return 0;
    if (Number.isFinite(stats.tacle)) return Math.max(0, stats.tacle);
    const agi = Number.isFinite(stats.agilite) ? stats.agilite : 0;
    return Math.max(0, Math.floor(agi / 10));
  };

  const getDerivedFuite = (stats) => {
    if (!stats) return 0;
    if (Number.isFinite(stats.fuite)) return Math.max(0, stats.fuite);
    const agi = Number.isFinite(stats.agilite) ? stats.agilite : 0;
    return Math.max(0, Math.floor(agi / 10));
  };

  const computeTacleMalusPercent = (tacle, fuite, hasAdjacency = false) => {
    if (tacle <= 0) {
      if (!hasAdjacency) return 0;
      return fuite >= 2 ? 0 : 0.25;
    }
    if (fuite <= 0 && tacle <= 1) return 0.25;
    if (fuite <= 0 && tacle <= 2) return 0.5;
    if (fuite >= tacle * 1.5) return 0;

    if (fuite >= tacle) {
      const span = tacle * 0.5;
      const progress = (fuite - tacle) / span;
      const pct = 0.25 * (1 - Math.min(1, Math.max(0, progress)));
      return pct;
    }

    const pct = (tacle - fuite) / tacle;
    return Math.min(1, Math.max(0.25, pct));
  };

  const computeLoss = (amount, pct) => {
    if (amount <= 0 || pct <= 0) return 0;
    const raw = Math.ceil(amount * pct);
    return Math.max(1, raw);
  };

  const getTacleLossForMove = (combat, moverId) => {
    if (!combat || !Number.isInteger(moverId)) return 0;
    const snapshot = ensureCombatSnapshot(combat);
    if (!snapshot) return 0;
    const moverEntry =
      snapshot.players.find((p) => p && p.playerId === moverId) || null;
    if (!moverEntry) return 0;
    if (!Number.isInteger(moverEntry.tileX) || !Number.isInteger(moverEntry.tileY)) {
      return 0;
    }

    let totalTacle = 0;
    let hasAdjacency = false;
    snapshot.monsters.forEach((m) => {
      if (!m) return;
      const hp = Number.isFinite(m.hp) ? m.hp : Number.isFinite(m.hpMax) ? m.hpMax : 0;
      if (hp <= 0) return;
      if (!Number.isInteger(m.tileX) || !Number.isInteger(m.tileY)) return;
      const dist = Math.abs(m.tileX - moverEntry.tileX) + Math.abs(m.tileY - moverEntry.tileY);
      if (dist !== 1) return;
      hasAdjacency = true;
      const def = typeof getMonsterDef === "function" ? getMonsterDef(m.monsterId) : null;
      const stats = def?.statsOverrides || null;
      totalTacle += getDerivedTacle(stats);
    });

    const fuite = 0;
    const malusPct = computeTacleMalusPercent(totalTacle, fuite, hasAdjacency);
    if (malusPct <= 0) return 0;

    const pmRemaining = Number.isFinite(combat.pmRemainingByPlayer?.[moverId])
      ? combat.pmRemainingByPlayer[moverId]
      : Number.isFinite(state.players[moverId]?.pm)
        ? state.players[moverId].pm
        : 3;

    return computeLoss(pmRemaining, malusPct);
  };

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
      Number.isInteger(combat.activePlayerId) &&
      combat.activePlayerId !== clientInfo.id
    ) {
      return;
    }
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

    combat.pmRemainingByPlayer = combat.pmRemainingByPlayer || {};
    const basePm = Number.isFinite(player.pm) ? player.pm : 3;
    const currentPm = Number.isFinite(combat.pmRemainingByPlayer[player.id])
      ? combat.pmRemainingByPlayer[player.id]
      : basePm;
    const pmLoss = getTacleLossForMove(combat, player.id);
    const effectivePm = Math.max(0, currentPm - pmLoss);
    if (effectivePm <= 0) return;
    if (path.length > effectivePm) {
      path = path.slice(0, effectivePm);
    }
    if (path.length === 0) return;

    const last = path[path.length - 1];
    const toX = last.x;
    const toY = last.y;

    player.x = toX;
    player.y = toY;
    upsertSnapshotPlayer(combat, player.id);

    const moveCost = path.length;
    combat.pmRemainingByPlayer[player.id] = Math.max(0, currentPm - pmLoss - moveCost);

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

  function handleCmdCombatPlacement(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    if (!player || !player.inCombat || !player.combatId) return;

    const combatId = Number.isInteger(msg.combatId) ? msg.combatId : player.combatId;
    if (combatId !== player.combatId) return;
    const combat = state.combats[combatId];
    if (!combat || combat.phase !== "prep") return;
    if (
      Array.isArray(combat.participantIds) &&
      !combat.participantIds.includes(clientInfo.id)
    ) {
      return;
    }
    const mapId = typeof msg.mapId === "string" ? msg.mapId : player.mapId;
    if (player.mapId && mapId && mapId !== player.mapId) return;

    const tileX = Number.isInteger(msg.tileX) ? msg.tileX : null;
    const tileY = Number.isInteger(msg.tileY) ? msg.tileY : null;
    if (tileX === null || tileY === null) return;

    const placement = resolveCombatPlacement(combat);
    if (!placement || !Array.isArray(placement.playerTiles)) return;
    const allowed = placement.playerTiles.some((t) => t.x === tileX && t.y === tileY);
    if (!allowed) return;

    combat.prepPlacements = combat.prepPlacements || {};
    const usedByOther = Object.entries(combat.prepPlacements).some(([pid, tile]) => {
      const id = Number(pid);
      if (!Number.isInteger(id) || id === player.id) return false;
      return tile && tile.x === tileX && tile.y === tileY;
    });
    if (usedByOther) return;

    combat.prepPlacements[player.id] = { x: tileX, y: tileY };
    player.x = tileX;
    player.y = tileY;
    upsertSnapshotPlayer(combat, player.id);
    if (combat.stateSnapshot) {
      broadcast({
        t: "EvCombatState",
        combatId: combat.id,
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
        players: Array.isArray(combat.stateSnapshot.players)
          ? combat.stateSnapshot.players
          : [],
        monsters: Array.isArray(combat.stateSnapshot.monsters)
          ? combat.stateSnapshot.monsters
          : [],
      });
    }
  }

  function handleCmdCombatMonsterMoveStart(clientInfo, msg) {
    const combatId = Number.isInteger(msg.combatId) ? msg.combatId : null;
    if (!combatId) return;
    const combat = state.combats[combatId];
    if (!combat) return;
    if (!Number.isInteger(combat.aiDriverId)) return;
    if (clientInfo.id !== combat.aiDriverId) return;
    if (combat.phase !== "combat") return;
    if (combat.turn !== "monster") return;
    const entityId = Number.isInteger(msg.entityId) ? msg.entityId : null;
    const combatIndex = Number.isInteger(msg.combatIndex) ? msg.combatIndex : null;
    if (!entityId && combatIndex === null) return;
    if (entityId) {
      const leaderIds =
        Array.isArray(combat.mobEntityIds) && combat.mobEntityIds.length > 0
          ? combat.mobEntityIds
          : [];
      const mobEntries = Array.isArray(combat.mobEntries) ? combat.mobEntries : [];
      const matchesEntry = mobEntries.some(
        (m) => m && Number.isInteger(m.entityId) && m.entityId === entityId
      );
      if (leaderIds.length > 0 && !leaderIds.includes(entityId) && !matchesEntry) {
        return;
      }
    }
    if (combatIndex !== null) {
      const mobEntries = Array.isArray(combat.mobEntries) ? combat.mobEntries : [];
      const matchesIndex = mobEntries.some(
        (m) => Number.isInteger(m?.combatIndex) && m.combatIndex === combatIndex
      );
      if (!matchesIndex) return;
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

    if (typeof ctx.debugLog === "function") {
      ctx.debugLog("EvCombatMonsterMoveStart broadcast", {
        combatId,
        entityId,
        combatIndex,
        steps: path.length,
        mapId,
      });
    }

    if (combat.stateSnapshot) {
      const last = path[path.length - 1];
      if (last) {
        upsertSnapshotMonster(combat, {
          entityId,
          combatIndex,
          tileX: last.x,
          tileY: last.y,
        });
      }
    }

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

  return {
    handleCmdMoveCombat,
    handleCmdCombatPlacement,
    handleCmdCombatMonsterMoveStart,
  };
}

module.exports = {
  createMoveHandlers,
};
