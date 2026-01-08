function createTurnHandlers(ctx, helpers) {
  const { state, broadcast } = ctx;
  const {
    ensureCombatSnapshot,
    buildCombatActorOrder,
    runMonsterAiTurn,
  } = helpers;

  const isMonsterAlive = (entry) => {
    if (!entry) return false;
    const hp = Number.isFinite(entry.hp) ? entry.hp : Number.isFinite(entry.hpMax) ? entry.hpMax : 0;
    return hp > 0;
  };

  const isPlayerAlive = (entry) => {
    if (!entry) return false;
    const hp = Number.isFinite(entry.hp) ? entry.hp : Number.isFinite(entry.hpMax) ? entry.hpMax : 0;
    return hp > 0;
  };

  const getActorOrder = (combat) => {
    const order = Array.isArray(combat.actorOrder) ? combat.actorOrder : buildCombatActorOrder(combat);
    combat.actorOrder = order;
    return order;
  };

  const resolveActor = (combat, actor) => {
    const snapshot = ensureCombatSnapshot(combat);
    if (!snapshot) return null;
    if (actor.kind === "joueur") {
      const entry = snapshot.players.find((p) => p && p.playerId === actor.playerId) || null;
      if (!entry || !isPlayerAlive(entry)) return null;
      return { kind: "joueur", playerId: actor.playerId };
    }
    const monster =
      (Number.isInteger(actor.entityId)
        ? snapshot.monsters.find((m) => m && m.entityId === actor.entityId)
        : null) ||
      (Number.isInteger(actor.combatIndex)
        ? snapshot.monsters.find((m) => m && m.combatIndex === actor.combatIndex)
        : null) ||
      null;
    if (!monster || !isMonsterAlive(monster)) return null;
    return {
      kind: "monstre",
      entityId: Number.isInteger(monster.entityId) ? monster.entityId : null,
      combatIndex: Number.isInteger(monster.combatIndex) ? monster.combatIndex : null,
      monsterId: monster.monsterId || null,
    };
  };

  const findNextActorIndex = (combat, startIndex) => {
    const order = getActorOrder(combat);
    if (!order.length) return -1;
    const total = order.length;
    const start = Number.isInteger(startIndex) ? startIndex : -1;
    for (let step = 1; step <= total; step += 1) {
      const idx = (start + step) % total;
      const actor = order[idx];
      const resolved = actor ? resolveActor(combat, actor) : null;
      if (resolved) return idx;
    }
    return -1;
  };

  const applyActiveActor = (combat, actor) => {
    if (!actor) return;
    combat.turn = actor.kind === "monstre" ? "monster" : "player";
    if (actor.kind === "joueur") {
      combat.activePlayerId = actor.playerId;
      combat.activeMonsterId = null;
      combat.activeMonsterIndex = null;
    } else {
      combat.activePlayerId = null;
      combat.activeMonsterId = Number.isInteger(actor.entityId) ? actor.entityId : null;
      combat.activeMonsterIndex = Number.isInteger(actor.combatIndex) ? actor.combatIndex : null;
    }
  };

  const broadcastTurnStarted = (combat, actor) => {
    if (!combat || !actor) return;
    broadcast({
      t: "EvCombatTurnStarted",
      combatId: combat.id,
      actorType: actor.kind === "monstre" ? "monster" : "player",
      activePlayerId: actor.kind === "joueur" ? actor.playerId : null,
      activeMonsterId: actor.kind === "monstre" ? actor.entityId : null,
      activeMonsterIndex: actor.kind === "monstre" ? actor.combatIndex : null,
      round: combat.round,
    });
  };

  const broadcastTurnEnded = (combat, actorType) => {
    broadcast({
      t: "EvCombatTurnEnded",
      combatId: combat.id,
      actorType,
    });
  };

  const advanceCombatTurn = (combat, actorType) => {
    if (!combat) return;
    const order = getActorOrder(combat);
    if (!order.length) return;

    broadcastTurnEnded(combat, actorType);

    const nextIndex = findNextActorIndex(combat, combat.actorIndex);
    if (nextIndex < 0) return;
    const wrapped = Number.isInteger(combat.actorIndex) && nextIndex <= combat.actorIndex;
    combat.actorIndex = nextIndex;
    if (wrapped) {
      combat.round = (combat.round || 1) + 1;
    }

    const nextActor = resolveActor(combat, order[nextIndex]);
    if (!nextActor) return;
    applyActiveActor(combat, nextActor);
    if (nextActor.kind === "joueur" && Number.isInteger(combat.activePlayerId)) {
      const p = state.players[combat.activePlayerId];
      const basePm = Number.isFinite(p?.pm) ? p.pm : 3;
      combat.pmRemainingByPlayer = combat.pmRemainingByPlayer || {};
      combat.pmRemainingByPlayer[combat.activePlayerId] = basePm;
    }
    broadcastTurnStarted(combat, nextActor);

    if (nextActor.kind === "monstre") {
      runMonsterAiTurn(combat, () => {
        advanceCombatTurn(combat, "monster");
      });
    }

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
  };

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
    } else {
      return;
    }

    advanceCombatTurn(combat, "player");
  }

  return {
    handleCmdEndTurnCombat,
    advanceCombatTurn,
  };
}

module.exports = {
  createTurnHandlers,
};
