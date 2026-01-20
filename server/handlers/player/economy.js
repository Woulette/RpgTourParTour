function createEconomyHandlers({ state, persistPlayerState, helpers, sync, MAX_GOLD_DELTA }) {
  const { logAntiDup } = helpers;
  const { sendPlayerSync } = sync;

  function handleCmdGoldOp(ws, clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    if (msg.__server !== true) return;
    const delta = Number.isFinite(msg.delta) ? Math.round(msg.delta) : 0;
    if (!delta || Math.abs(delta) > MAX_GOLD_DELTA) return;
    const player = state.players[clientInfo.id];
    if (!player) return;
    const beforeGold = Number.isFinite(player.gold) ? player.gold : 0;
    const nextGold = Math.max(0, beforeGold + delta);
    if (nextGold === beforeGold) return;
    player.gold = nextGold;

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }

    logAntiDup({
      ts: Date.now(),
      reason: msg.reason || "CmdGoldOp",
      accountId: player.accountId || null,
      characterId: player.characterId || null,
      playerId: player.id || null,
      mapId: player.mapId || null,
      goldDelta: nextGold - beforeGold,
    });

    sendPlayerSync(ws, player, "gold");
    return nextGold - beforeGold;
  }

  return {
    handleCmdGoldOp,
    applyGoldOpFromServer(playerId, delta, reason) {
      if (!Number.isInteger(playerId)) return 0;
      const msg = {
        __server: true,
        playerId,
        delta,
        reason: reason || "server",
      };
      const player = state.players[playerId];
      if (!player) return 0;
      return handleCmdGoldOp(null, { id: playerId }, msg) || 0;
    },
  };
}

module.exports = {
  createEconomyHandlers,
};
