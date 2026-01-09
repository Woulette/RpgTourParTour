function createPlayerHandlers(ctx) {
  const {
    state,
    clients,
    broadcast,
    send,
    createPlayer,
    characterStore,
    buildBaseStatsForClass,
    computeFinalStats,
    config,
    getNextPlayerId,
    getNextEventId,
    getHostId,
    setHostId,
    tryStartCombatIfNeeded,
    snapshotForClient,
    ensureMapInitialized,
    persistPlayerState,
    getCombatJoinPayload,
    ensureCombatSnapshot,
  } = ctx;

  const { PROTOCOL_VERSION, GAME_DATA_VERSION, MAX_PLAYERS } = config;

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

    const characterId = typeof msg.characterId === "string" ? msg.characterId : null;
    if (!characterId || !characterStore) {
      send(ws, { t: "EvRefuse", reason: "character_required" });
      ws.close();
      return;
    }

    if (clients.size >= MAX_PLAYERS) {
      send(ws, { t: "EvRefuse", reason: "room_full" });
      ws.close();
      return;
    }

    if (typeof buildBaseStatsForClass !== "function" || typeof computeFinalStats !== "function") {
      send(ws, { t: "EvRefuse", reason: "server_loading" });
      ws.close();
      return;
    }

    const incomingName = typeof msg.characterName === "string" ? msg.characterName : null;
    const incomingClassId = typeof msg.classId === "string" ? msg.classId : null;
    const incomingLevel = Number.isInteger(msg.level) ? msg.level : null;

    const existingPlayer = Object.values(state.players).find(
      (p) => p && p.characterId === characterId
    );
    if (existingPlayer) {
      const alreadyConnected = Array.from(clients.values()).some(
        (info) => info && info.id === existingPlayer.id
      );
      if (alreadyConnected) {
        send(ws, { t: "EvRefuse", reason: "character_in_use" });
        ws.close();
        return;
      }

      existingPlayer.connected = true;
      clients.set(ws, {
        id: existingPlayer.id,
        lastCmdId: 0,
        ready: true,
        lastAckEventId: 0,
      });

      if (!getHostId()) {
        setHostId(existingPlayer.id);
      }

      send(ws, {
        t: "EvWelcome",
        eventId: getNextEventId(),
        playerId: existingPlayer.id,
        hostId: getHostId(),
        isHost: existingPlayer.id === getHostId(),
        protocolVersion: PROTOCOL_VERSION,
        dataHash: GAME_DATA_VERSION,
        snapshot: snapshotForClient(),
      });

      sendCombatResync(ws, existingPlayer);
      broadcast({ t: "EvPlayerJoined", player: existingPlayer });
      return;
    }

    let character = characterStore.getCharacter(characterId);
    if (!character) {
      const baseStats = buildBaseStatsForClass(incomingClassId || "archer");
      character = characterStore.upsertCharacter({
        characterId,
        name: incomingName || "Joueur",
        classId: incomingClassId || "archer",
        level: incomingLevel ?? 1,
        baseStats,
      });
    }
    if (!character) {
      send(ws, { t: "EvRefuse", reason: "character_invalid" });
      ws.close();
      return;
    }

    const baseStats =
      character.baseStats || buildBaseStatsForClass(character.classId || "archer");
    const finalStats = computeFinalStats(baseStats) || {};
    const computedHpMax = Number.isFinite(finalStats.hpMax) ? finalStats.hpMax : 0;
    const savedHpMax = Number.isFinite(character.hpMax) ? character.hpMax : null;
    const hpMax = savedHpMax !== null ? Math.max(savedHpMax, computedHpMax) : computedHpMax;
    const savedHp = Number.isFinite(character.hp) ? character.hp : null;
    const hp = savedHp !== null ? Math.min(savedHp, hpMax) : hpMax;

    const playerId = getNextPlayerId();
    const player = createPlayer(playerId);
    player.connected = true;
    player.characterId = character.characterId;
    player.accountId = character.accountId || null;
    player.classId = character.classId || "archer";
    player.displayName = character.name || "Joueur";
    player.level = Number.isInteger(character.level) ? character.level : 1;
    player.baseStats = baseStats || null;
    player.stats = finalStats || null;
    player.hp = Number.isFinite(hp) ? hp : player.hp;
    player.hpMax = Number.isFinite(hpMax) ? hpMax : player.hpMax;
    if (player.stats) {
      player.stats.hp = player.hp;
      player.stats.hpMax = player.hpMax;
    }
    player.pa = Number.isFinite(finalStats.pa) ? finalStats.pa : player.pa;
    player.pm = Number.isFinite(finalStats.pm) ? finalStats.pm : player.pm;
    player.initiative = Number.isFinite(finalStats.initiative)
      ? finalStats.initiative
      : player.initiative;
    player.capturedMonsterId =
      typeof character.capturedMonsterId === "string" ? character.capturedMonsterId : null;
    player.capturedMonsterLevel = Number.isFinite(character.capturedMonsterLevel)
      ? character.capturedMonsterLevel
      : null;
    player.inventory = character.inventory || null;
    player.gold = Number.isFinite(character.gold) ? character.gold : player.gold;
    player.mapId = character.mapId || state.mapId;
    if (Number.isFinite(character.posX) && Number.isFinite(character.posY)) {
      player.x = character.posX;
      player.y = character.posY;
    }
    state.players[playerId] = player;
    clients.set(ws, { id: playerId, lastCmdId: 0, ready: true, lastAckEventId: 0 });

    if (!getHostId()) {
      setHostId(playerId);
    }

    if (typeof ensureMapInitialized === "function" && player.mapId) {
      ensureMapInitialized(player.mapId);
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

  function handleCmdCombatResync(clientInfo, msg) {
    if (!clientInfo || !Number.isInteger(clientInfo.id)) return;
    const player = state.players[clientInfo.id];
    if (!player) return;
    const ws = Array.from(clients.entries()).find(([, info]) => info?.id === player.id)?.[0];
    if (!ws) return;
    sendCombatResync(ws, player);
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
    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
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
    handleCmdCombatResync,
  };
}

module.exports = {
  createPlayerHandlers,
};
