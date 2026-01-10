function createCombatHandlers({
  state,
  clients,
  send,
  broadcast,
  getNextEventId,
  getCombatJoinPayload,
  ensureCombatSnapshot,
}) {
  const sendCombatResync = (ws, player) => {
    if (!player || !player.inCombat) return;
    if (typeof getCombatJoinPayload !== "function") return;
    const payload = getCombatJoinPayload(player.id);
    if (!payload) return;
    send(ws, {
      t: "EvCombatJoinReady",
      eventId: getNextEventId(),
      ...payload,
    });
    send(ws, {
      t: "EvCombatUpdated",
      eventId: getNextEventId(),
      ...payload.combat,
    });
    const combatId = payload.combat?.combatId;
    if (!combatId) return;
    const combat = state.combats[combatId];
    const snapshot =
      combat && typeof ensureCombatSnapshot === "function"
        ? ensureCombatSnapshot(combat)
        : combat?.stateSnapshot || null;
    if (!combat || !snapshot) return;
    send(ws, {
      t: "EvCombatState",
      eventId: getNextEventId(),
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
      activeSummonId: Number.isInteger(combat.activeSummonId)
        ? combat.activeSummonId
        : null,
      actorOrder: combat.actorOrder || undefined,
      players: Array.isArray(snapshot.players) ? snapshot.players : [],
      monsters: Array.isArray(snapshot.monsters) ? snapshot.monsters : [],
      summons: Array.isArray(snapshot.summons) ? snapshot.summons : [],
      resync: true,
    });
  };

  function handleCmdCombatResync(clientInfo, msg) {
    if (!clientInfo || !Number.isInteger(clientInfo.id)) return;
    const player = state.players[clientInfo.id];
    if (!player) return;
    const ws = Array.from(clients.entries()).find(([, info]) => info?.id === player.id)?.[0];
    if (!ws) return;
    sendCombatResync(ws, player);
  }

  function handleCmdEndTurn(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    if (state.combat.activeId !== msg.playerId) return;

    const playerIds = Object.keys(state.players).map((id) => Number(id));
    if (playerIds.length === 0) return;

    const currentIndex = playerIds.indexOf(state.combat.activeId);
    const nextIndex = (currentIndex + 1) % playerIds.length;
    const nextId = playerIds[nextIndex];

    broadcast({ t: "EvTurnEnded", playerId: state.combat.activeId });
    state.combat.activeId = nextId;
    state.combat.turnIndex += 1;
    broadcast({ t: "EvTurnStarted", playerId: nextId });
  }

  return {
    sendCombatResync,
    handleCmdCombatResync,
    handleCmdEndTurn,
  };
}

module.exports = {
  createCombatHandlers,
};
