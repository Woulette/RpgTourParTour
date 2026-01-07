function createPlayerHandlers(ctx) {
  const {
    state,
    clients,
    broadcast,
    send,
    createPlayer,
    config,
    getNextPlayerId,
    getNextEventId,
    getHostId,
    setHostId,
    tryStartCombatIfNeeded,
    snapshotForClient,
    ensureMapInitialized,
  } = ctx;

  const { PROTOCOL_VERSION, GAME_DATA_VERSION, MAX_PLAYERS } = config;

  function handleHello(ws, msg) {
    const protoOk = msg.protocolVersion === PROTOCOL_VERSION;
    const dataOk = msg.dataHash === GAME_DATA_VERSION;
    if (!protoOk || !dataOk) {
      send(ws, {
        t: "EvRefuse",
        reason: "version_mismatch",
        protocolVersion: PROTOCOL_VERSION,
        dataHash: GAME_DATA_VERSION,
      });
      ws.close();
      return;
    }

    if (clients.size >= MAX_PLAYERS) {
      send(ws, { t: "EvRefuse", reason: "room_full" });
      ws.close();
      return;
    }

    const playerId = getNextPlayerId();
    const player = createPlayer(playerId);
    player.mapId = state.mapId;
    state.players[playerId] = player;
    clients.set(ws, { id: playerId, lastCmdId: 0, ready: true });

    if (!getHostId()) {
      setHostId(playerId);
    }

    tryStartCombatIfNeeded();

    send(ws, {
      t: "EvWelcome",
      eventId: getNextEventId(),
      playerId,
      hostId: getHostId(),
      isHost: playerId === getHostId(),
      protocolVersion: PROTOCOL_VERSION,
      dataHash: GAME_DATA_VERSION,
      snapshot: snapshotForClient(),
    });

    broadcast({ t: "EvPlayerJoined", player });
  }

  function handleCmdMove(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    if (!Number.isInteger(msg.toX) || !Number.isInteger(msg.toY)) return;

    const player = state.players[clientInfo.id];
    if (!player) return;
    if (player.inCombat) return;
    const seq = Number.isInteger(msg.seq) ? msg.seq : 0;
    if (seq <= (player.lastMoveSeq || 0)) return;
    player.lastMoveSeq = seq;

    let path = Array.isArray(msg.path) ? msg.path : [];
    if (path.length > 200) {
      path = path.slice(0, 200);
    }
    path = path
      .map((step) => ({
        x: Number.isInteger(step?.x) ? step.x : null,
        y: Number.isInteger(step?.y) ? step.y : null,
      }))
      .filter((step) => step.x !== null && step.y !== null);

    const from = { x: player.x, y: player.y };
    const last = path.length > 0 ? path[path.length - 1] : null;
    player.x = last ? last.x : msg.toX;
    player.y = last ? last.y : msg.toY;

    broadcast({
      t: "EvMoveStart",
      seq,
      playerId: player.id,
      mapId: player.mapId,
      fromX: from.x,
      fromY: from.y,
      toX: player.x,
      toY: player.y,
      path,
    });
  }

  function handleCmdMapChange(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (!mapId) return;

    const player = state.players[clientInfo.id];
    if (!player) return;
    if (player.inCombat) return;

    player.mapId = mapId;

    if (Number.isInteger(msg.tileX) && Number.isInteger(msg.tileY)) {
      player.x = msg.tileX;
      player.y = msg.tileY;
    }

    broadcast({
      t: "EvPlayerMap",
      playerId: player.id,
      mapId: player.mapId,
      tileX: player.x,
      tileY: player.y,
    });

    ensureMapInitialized(mapId);
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
    handleHello,
    handleCmdMove,
    handleCmdMapChange,
    handleCmdEndTurn,
  };
}

module.exports = {
  createPlayerHandlers,
};
