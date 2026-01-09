function createPlayerHandlers(ctx) {
  const {
    state,
    clients,
    broadcast,
    send,
    createPlayer,
    accountStore,
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
    issueSessionToken,
    getAccountIdFromSession,
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

  function findPathOnGrid(startX, startY, endX, endY, meta, blocked, allowDiagonal, maxSteps) {
    if (!meta) return null;
    if (startX === endX && startY === endY) return [];
    const width = meta.width;
    const height = meta.height;
    if (
      startX < 0 ||
      startY < 0 ||
      endX < 0 ||
      endY < 0 ||
      startX >= width ||
      startY >= height ||
      endX >= width ||
      endY >= height
    ) {
      return null;
    }
    if (blocked && blocked.has(`${endX},${endY}`)) return null;

    const dirs4 = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    const dirs8 = [
      ...dirs4,
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: -1 },
    ];
    const dirs = allowDiagonal ? dirs8 : dirs4;

    const key = (x, y) => `${x},${y}`;
    const visited = new Set([key(startX, startY)]);
    const prev = new Map();
    const queue = [{ x: startX, y: startY }];
    let qi = 0;

    while (qi < queue.length) {
      const current = queue[qi++];
      for (const { dx, dy } of dirs) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const k = key(nx, ny);
        if (visited.has(k)) continue;
        if (blocked && blocked.has(k)) continue;
        visited.add(k);
        prev.set(k, current);
        if (nx === endX && ny === endY) {
          const path = [{ x: nx, y: ny }];
          let back = current;
          while (back && !(back.x === startX && back.y === startY)) {
            path.push({ x: back.x, y: back.y });
            back = prev.get(key(back.x, back.y));
          }
          path.reverse();
          if (Number.isInteger(maxSteps) && path.length > maxSteps) {
            return null;
          }
          return path;
        }
        if (
          Number.isInteger(maxSteps) &&
          Math.abs(nx - startX) + Math.abs(ny - startY) > maxSteps
        ) {
          continue;
        }
        queue.push({ x: nx, y: ny });
      }
    }

    return null;
  }

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

    const sessionToken =
      typeof msg.sessionToken === "string" ? msg.sessionToken : null;
    const accountName =
      typeof msg.accountName === "string" ? msg.accountName : null;
    const accountPassword =
      typeof msg.accountPassword === "string" ? msg.accountPassword : null;
    const authMode =
      msg.authMode === "register"
        ? "register"
        : msg.authMode === "login"
          ? "login"
          : "auto";
    let accountId = null;

    const hasCredentials = !!(accountName && accountPassword);
    if (!hasCredentials && typeof getAccountIdFromSession === "function" && sessionToken) {
      accountId = getAccountIdFromSession(sessionToken);
    }

    if (!accountId) {
      if (!accountStore) {
        send(ws, { t: "EvRefuse", reason: "auth_unavailable" });
        ws.close();
        return;
      }
      if (!hasCredentials) {
        send(ws, { t: "EvRefuse", reason: "auth_required" });
        ws.close();
        return;
      }
      const existingAccount = accountStore.getAccountByName(accountName);
      if (authMode === "register") {
        if (existingAccount) {
          send(ws, { t: "EvRefuse", reason: "account_exists" });
          ws.close();
          return;
        }
        const created = accountStore.createAccount({
          name: accountName,
          password: accountPassword,
        });
        if (!created) {
          send(ws, { t: "EvRefuse", reason: "auth_failed" });
          ws.close();
          return;
        }
        accountId = created.accountId;
      } else if (authMode === "login") {
        if (!existingAccount) {
          send(ws, { t: "EvRefuse", reason: "account_missing" });
          ws.close();
          return;
        }
        const ok = accountStore.verifyPassword(existingAccount, accountPassword);
        if (!ok) {
          send(ws, { t: "EvRefuse", reason: "auth_failed" });
          ws.close();
          return;
        }
        accountId = existingAccount.accountId;
      } else if (existingAccount) {
        const ok = accountStore.verifyPassword(existingAccount, accountPassword);
        if (!ok) {
          send(ws, { t: "EvRefuse", reason: "auth_failed" });
          ws.close();
          return;
        }
        accountId = existingAccount.accountId;
      } else {
        const created = accountStore.createAccount({
          name: accountName,
          password: accountPassword,
        });
        if (!created) {
          send(ws, { t: "EvRefuse", reason: "auth_failed" });
          ws.close();
          return;
        }
        accountId = created.accountId;
      }
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
      if (existingPlayer.accountId && existingPlayer.accountId !== accountId) {
        send(ws, { t: "EvRefuse", reason: "character_owned" });
        ws.close();
        return;
      }
      const accountAlreadyConnected = Object.values(state.players).some(
        (p) => p && p.accountId === accountId && p.connected !== false
      );
      if (accountAlreadyConnected) {
        send(ws, { t: "EvRefuse", reason: "account_in_use" });
        ws.close();
        return;
      }
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

      const nextSessionToken =
        typeof issueSessionToken === "function"
          ? issueSessionToken(accountId)
          : null;
      send(ws, {
        t: "EvWelcome",
        eventId: getNextEventId(),
        playerId: existingPlayer.id,
        hostId: getHostId(),
        isHost: existingPlayer.id === getHostId(),
        protocolVersion: PROTOCOL_VERSION,
        dataHash: GAME_DATA_VERSION,
        sessionToken: nextSessionToken,
        snapshot: snapshotForClient(),
      });

      sendCombatResync(ws, existingPlayer);
      broadcast({
        t: "EvPlayerJoined",
        mapId: existingPlayer.mapId || null,
        player: existingPlayer,
      });
      return;
    }

    const accountAlreadyConnected = Object.values(state.players).some(
      (p) => p && p.accountId === accountId && p.connected !== false
    );
    if (accountAlreadyConnected) {
      send(ws, { t: "EvRefuse", reason: "account_in_use" });
      ws.close();
      return;
    }

    let character = characterStore.getCharacter(characterId);
    if (!character) {
      if (incomingName && typeof characterStore.getCharacterByName === "function") {
        const taken = characterStore.getCharacterByName(incomingName);
        if (taken && taken.characterId !== characterId) {
          send(ws, { t: "EvRefuse", reason: "name_in_use" });
          ws.close();
          return;
        }
      }
      const baseStats = buildBaseStatsForClass(incomingClassId || "archer");
      character = characterStore.upsertCharacter({
        characterId,
        accountId,
        name: incomingName || "Joueur",
        classId: incomingClassId || "archer",
        level: incomingLevel ?? 1,
        baseStats,
      });
    } else if (character.accountId && character.accountId !== accountId) {
      send(ws, { t: "EvRefuse", reason: "character_owned" });
      ws.close();
      return;
    }
    if (!character) {
      send(ws, { t: "EvRefuse", reason: "character_invalid" });
      ws.close();
      return;
    }
    if (!character.accountId && accountId && characterStore) {
      character = characterStore.upsertCharacter({
        ...character,
        accountId,
      });
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
    player.accountId = character.accountId || accountId || null;
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

    const nextSessionToken =
      typeof issueSessionToken === "function"
        ? issueSessionToken(accountId)
        : null;
    send(ws, {
      t: "EvWelcome",
      eventId: getNextEventId(),
      playerId,
      hostId: getHostId(),
      isHost: playerId === getHostId(),
      protocolVersion: PROTOCOL_VERSION,
      dataHash: GAME_DATA_VERSION,
      sessionToken: nextSessionToken,
      snapshot: snapshotForClient(),
    });

    broadcast({
      t: "EvPlayerJoined",
      mapId: player.mapId || null,
      player,
    });
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
    player.lastMoveAt = 0;

    const mapId = player.mapId;
    const meta = mapId ? state.mapMeta[mapId] : null;
    const blocked = mapId ? state.mapCollisions?.[mapId] : null;
    if (!meta || !Number.isInteger(meta.width) || !Number.isInteger(meta.height)) {
      if (typeof ensureMapInitialized === "function" && mapId) {
        ensureMapInitialized(mapId);
      }
      return;
    }

    const MAX_PATH_STEPS = 200;
    const MIN_MOVE_MS = 120;
    const now = Date.now();
    const cmdFromX = Number.isInteger(msg.fromX) ? msg.fromX : null;
    const cmdFromY = Number.isInteger(msg.fromY) ? msg.fromY : null;
    if (
      cmdFromX !== null &&
      cmdFromY !== null &&
      cmdFromX >= 0 &&
      cmdFromY >= 0 &&
      cmdFromX < meta.width &&
      cmdFromY < meta.height
    ) {
      const dx = Math.abs(cmdFromX - player.x);
      const dy = Math.abs(cmdFromY - player.y);
      const dist = dx + dy;
      const MAX_DESYNC_TILES = 200;
      if (dist > 0 && dist <= MAX_DESYNC_TILES) {
        player.x = cmdFromX;
        player.y = cmdFromY;
      }
    }

    let prevX = Number.isInteger(player.x) ? player.x : null;
    let prevY = Number.isInteger(player.y) ? player.y : null;
    if (prevX === null || prevY === null) return;
    let invalid = false;
    const sendMoveCorrection = () => {
      broadcast({
        t: "EvMoveStart",
        seq,
        playerId: player.id,
        mapId,
        fromX: player.x,
        fromY: player.y,
        toX: player.x,
        toY: player.y,
        path: [],
        rejected: true,
      });
    };

    if (invalid) {
      sendMoveCorrection();
      return;
    }

    const from = { x: player.x, y: player.y };
    const targetX = msg.toX;
    const targetY = msg.toY;
    if (
      targetX < 0 ||
      targetY < 0 ||
      targetX >= meta.width ||
      targetY >= meta.height
    ) {
      return;
    }
    if (blocked && blocked.has(`${targetX},${targetY}`)) {
      sendMoveCorrection();
      return;
    }

    const serverPath = findPathOnGrid(
      from.x,
      from.y,
      targetX,
      targetY,
      meta,
      blocked,
      true,
      MAX_PATH_STEPS
    );
    if (!serverPath) {
      sendMoveCorrection();
      return;
    }

    const lastMoveAt = Number.isFinite(player.lastMoveAt) ? player.lastMoveAt : 0;
    if (lastMoveAt && now - lastMoveAt < MIN_MOVE_MS) {
      sendMoveCorrection();
      return;
    }

    player.x = targetX;
    player.y = targetY;
    player.lastMoveAt = now;

    broadcast({
      t: "EvMoveStart",
      seq,
      playerId: player.id,
      mapId,
      fromX: from.x,
      fromY: from.y,
      toX: player.x,
      toY: player.y,
      path: serverPath,
    });
  }

  function handleCmdMapChange(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (!mapId) return;

    const player = state.players[clientInfo.id];
    if (!player) return;
    if (player.inCombat) return;

    const fromMapId = player.mapId;
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
      fromMapId: typeof fromMapId === "string" ? fromMapId : null,
      tileX: player.x,
      tileY: player.y,
    });

    ensureMapInitialized(mapId);
  }

  function handleCmdRequestMapPlayers(ws, clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    if (!player) return;
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (!mapId || player.mapId !== mapId) return;
    const list = Object.values(state.players)
      .filter((p) => p && p.connected !== false && p.mapId === mapId)
      .map((p) => ({
        id: p.id,
        mapId: p.mapId,
        x: Number.isFinite(p.x) ? p.x : 0,
        y: Number.isFinite(p.y) ? p.y : 0,
        classId: p.classId || null,
        displayName: p.displayName || null,
        inCombat: p.inCombat === true,
        combatId: Number.isInteger(p.combatId) ? p.combatId : null,
      }));
    send(ws, {
      t: "EvMapPlayers",
      eventId: getNextEventId(),
      mapId,
      players: list,
    });
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
    handleCmdRequestMapPlayers,
  };
}

module.exports = {
  createPlayerHandlers,
};
