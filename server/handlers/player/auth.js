function createAuthHandlers({
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
  snapshotForClient,
  issueSessionToken,
  getAccountIdFromSession,
  combat,
  onPlayerConnected,
}) {
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

    const sessionToken =
      typeof msg.sessionToken === "string" ? msg.sessionToken : null;
    const inventoryAuthority = msg.inventoryAuthority === true;
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
      if (Number.isInteger(existingPlayer.combatId)) {
        const combatState = state.combats[existingPlayer.combatId];
        if (combatState?.pendingFinalizeTimer) {
          clearTimeout(combatState.pendingFinalizeTimer);
          combatState.pendingFinalizeTimer = null;
          combatState.pendingFinalizeAt = null;
        }
      }
      clients.set(ws, {
        id: existingPlayer.id,
        lastCmdId: 0,
        ready: true,
        lastAckEventId: 0,
        accountId: existingPlayer.accountId || accountId || null,
        inventoryAuthority,
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

      combat.sendCombatResync(ws, existingPlayer);
      broadcast({
        t: "EvPlayerJoined",
        mapId: existingPlayer.mapId || null,
        player: existingPlayer,
      });
      if (typeof onPlayerConnected === "function") {
        onPlayerConnected(existingPlayer.id);
      }
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
    const finalStats = computeFinalStats(baseStats, character?.equipment) || {};
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
    player.honorPoints = Number.isFinite(character.honorPoints)
      ? character.honorPoints
      : player.honorPoints;
    player.levelState = character.levelState || null;
    player.equipment = character.equipment || null;
    if (typeof computeFinalStats === "function" && player.baseStats) {
      const nextStats = computeFinalStats(player.baseStats, player.equipment);
      if (nextStats) {
        player.stats = nextStats;
        player.hpMax = Number.isFinite(nextStats.hpMax) ? nextStats.hpMax : player.hpMax;
        if (Number.isFinite(player.hp)) {
          player.hp = Math.min(player.hp, player.hpMax);
        } else if (Number.isFinite(nextStats.hp)) {
          player.hp = Math.min(nextStats.hp, player.hpMax);
        }
      }
    }
    player.trash = character.trash || null;
    player.quests = character.quests || null;
    player.achievements = character.achievements || null;
    player.metiers = character.metiers || null;
    player.spellParchments = character.spellParchments || null;
    player.mapId = character.mapId || state.mapId;
    if (Number.isFinite(character.posX) && Number.isFinite(character.posY)) {
      player.x = character.posX;
      player.y = character.posY;
    }
    state.players[playerId] = player;
    clients.set(ws, {
      id: playerId,
      lastCmdId: 0,
      ready: true,
      lastAckEventId: 0,
      accountId: player.accountId || accountId || null,
      inventoryAuthority,
    });

    if (!getHostId()) {
      setHostId(playerId);
    }

    const nextSessionToken =
      typeof issueSessionToken === "function" ? issueSessionToken(accountId) : null;
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

    if (typeof onPlayerConnected === "function") {
      onPlayerConnected(player.id);
    }

    try {
      combat.sendCombatResync(ws, player);
    } catch {
      // ignore resync errors
    }
    broadcast({
      t: "EvPlayerJoined",
      mapId: player.mapId || null,
      player,
    });
  }

  return {
    handleHello,
  };
}

module.exports = {
  createAuthHandlers,
};
