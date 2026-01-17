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
  ensureMapInitialized,
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
  const AUTH_RATE_WINDOW_MS = 10 * 60 * 1000;
  const AUTH_MAX_ATTEMPTS = 10;
  const AUTH_COOLDOWN_MS = 2000;
  const authRateByIp = new Map();
  const authRateByAccount = new Map();
  const DEFAULT_SAFE_SPAWN_TILE = { x: 17, y: 17 };

  function normalizeAccountName(name) {
    if (!name) return "";
    if (accountStore?.normalizeAccountName) {
      return accountStore.normalizeAccountName(name) || "";
    }
    return String(name || "").trim().toLowerCase();
  }

  function isValidAccountName(name) {
    if (!name) return false;
    const trimmed = String(name).trim();
    if (trimmed.length < 6 || trimmed.length > 20) return false;
    return /^[a-zA-Z0-9._-]+$/.test(trimmed);
  }

  function isValidPassword(password) {
    if (!password) return false;
    const value = String(password);
    if (value.length < 8 || value.length > 64) return false;
    return /[A-Z]/.test(value);
  }

  function getBucket(map, key, now) {
    if (!key) return null;
    const entry = map.get(key) || {
      count: 0,
      windowStart: now,
      lastAttemptAt: 0,
      blockedUntil: 0,
    };
    if (now - entry.windowStart >= AUTH_RATE_WINDOW_MS) {
      entry.count = 0;
      entry.windowStart = now;
      entry.blockedUntil = 0;
    }
    map.set(key, entry);
    return entry;
  }

  function checkRateLimit(entry, now) {
    if (!entry) return null;
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return "auth_rate_limited";
    }
    if (entry.lastAttemptAt && now - entry.lastAttemptAt < AUTH_COOLDOWN_MS) {
      return "auth_cooldown";
    }
    return null;
  }

  function noteAttempt(entry, now) {
    if (!entry) return;
    entry.lastAttemptAt = now;
  }

  function registerFailure(entry, now) {
    if (!entry) return;
    entry.count += 1;
    if (entry.count >= AUTH_MAX_ATTEMPTS) {
      entry.blockedUntil = entry.windowStart + AUTH_RATE_WINDOW_MS;
    }
  }

  function registerSuccess(entry, now) {
    if (!entry) return;
    entry.count = 0;
    entry.windowStart = now;
    entry.blockedUntil = 0;
  }

  function isMapReady(mapId) {
    if (!mapId) return false;
    const meta = state.mapMeta?.[mapId];
    return !!(meta && Number.isFinite(meta.width) && Number.isFinite(meta.height));
  }

  function isValidSpawnTile(mapId, x, y) {
    if (!mapId || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (typeof ensureMapInitialized === "function") {
      try {
        ensureMapInitialized(mapId);
      } catch {
        // ignore init errors
      }
    }
    const meta = state.mapMeta?.[mapId];
    const width = Number.isFinite(meta?.width) ? Math.round(meta.width) : null;
    const height = Number.isFinite(meta?.height) ? Math.round(meta.height) : null;
    if (!width || !height) return false;
    const tileX = Math.round(x);
    const tileY = Math.round(y);
    if (tileX < 0 || tileY < 0 || tileX >= width || tileY >= height) return false;
    const edgeMargin = 1;
    if (width > edgeMargin * 2 && height > edgeMargin * 2) {
      if (
        tileX <= edgeMargin ||
        tileY <= edgeMargin ||
        tileX >= width - 1 - edgeMargin ||
        tileY >= height - 1 - edgeMargin
      ) {
        return false;
      }
    }
    const groundTiles = meta?.groundTiles;
    if (groundTiles && typeof groundTiles.has === "function") {
      if (!groundTiles.has(`${tileX},${tileY}`)) return false;
    }
    const collisions = state.mapCollisions?.[mapId];
    if (collisions && typeof collisions.has === "function") {
      if (collisions.has(`${tileX},${tileY}`)) return false;
    }
    return true;
  }

  function resolveSpawnPosition(preferredMapId) {
    const fallbackMapId = state.mapId || null;
    let mapId = preferredMapId || fallbackMapId || null;
    if (!mapId) return null;
    if (typeof ensureMapInitialized === "function") {
      try {
        ensureMapInitialized(mapId);
      } catch {
        // ignore init errors
      }
    }
    let meta = state.mapMeta?.[mapId];
    let collisions = state.mapCollisions?.[mapId];
    let width = Number.isFinite(meta?.width) ? Math.round(meta.width) : null;
    let height = Number.isFinite(meta?.height) ? Math.round(meta.height) : null;
    if ((!width || !height) && fallbackMapId && mapId !== fallbackMapId) {
      mapId = fallbackMapId;
      if (typeof ensureMapInitialized === "function") {
        try {
          ensureMapInitialized(mapId);
        } catch {
          // ignore init errors
        }
      }
      meta = state.mapMeta?.[mapId];
      collisions = state.mapCollisions?.[mapId];
      width = Number.isFinite(meta?.width) ? Math.round(meta.width) : null;
      height = Number.isFinite(meta?.height) ? Math.round(meta.height) : null;
    }
    if (!width || !height) return null;
    const bounds = meta?.playableBounds;
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const minX = bounds ? bounds.minX : 0;
    const maxX = bounds ? bounds.maxX : width - 1;
    const minY = bounds ? bounds.minY : 0;
    const maxY = bounds ? bounds.maxY : height - 1;
    const startX = clamp(DEFAULT_SAFE_SPAWN_TILE.x, minX, maxX);
    const startY = clamp(DEFAULT_SAFE_SPAWN_TILE.y, minY, maxY);
    const groundTiles = meta?.groundTiles;
    const isBlocked = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return true;
      if (groundTiles && typeof groundTiles.has === "function") {
        if (!groundTiles.has(`${x},${y}`)) return true;
      }
      if (collisions && typeof collisions.has === "function") {
        return collisions.has(`${x},${y}`);
      }
      return false;
    };
    if (!isBlocked(startX, startY)) return { mapId, posX: startX, posY: startY };
    const maxRadius = Math.max(width, height);
    for (let r = 1; r <= maxRadius; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = startX + dx;
          const y = startY + dy;
          if (!isBlocked(x, y)) return { mapId, posX: x, posY: y };
        }
      }
    }
    return { mapId, posX: startX, posY: startY };
  }

  function buildAccountCharacters(accountId) {
    if (!characterStore || !accountId) return [];
    if (typeof characterStore.listCharactersByAccountId !== "function") return [];
    const list = characterStore.listCharactersByAccountId(accountId) || [];
    return list.map((entry) => ({
      characterId: entry.characterId,
      name: entry.name || "Joueur",
      classId: entry.classId || "archer",
      level: Number.isInteger(entry.level) ? entry.level : 1,
      updatedAt: Number.isFinite(entry.updatedAt) ? entry.updatedAt : null,
    }));
  }

  function sendAccountCharacters(ws, accountId) {
    const nextSessionToken =
      typeof issueSessionToken === "function" ? issueSessionToken(accountId) : null;
    send(ws, {
      t: "EvAccountCharacters",
      eventId: getNextEventId(),
      sessionToken: nextSessionToken,
      characters: buildAccountCharacters(accountId),
    });
  }

  function handleCharacterLogin({
    ws,
    accountId,
    characterId,
    incomingName,
    incomingClassId,
    incomingLevel,
    inventoryAuthority,
    allowCreate,
    retryCount,
  }) {
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
      if (!allowCreate) {
        send(ws, { t: "EvRefuse", reason: "character_missing" });
        ws.close();
        return;
      }
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

    const desiredMapId = character.mapId || state.mapId;
    if (!isMapReady(desiredMapId)) {
      if (typeof ensureMapInitialized === "function") {
        try {
          ensureMapInitialized(desiredMapId);
        } catch {
          // ignore init errors
        }
      }
      const attempts = Number.isInteger(retryCount) ? retryCount : 0;
      if (attempts < 20) {
        if (ws && ws.readyState === 1) {
          if (ws.__loginRetryTimer) clearTimeout(ws.__loginRetryTimer);
          ws.__loginRetryTimer = setTimeout(() => {
            handleCharacterLogin({
              ws,
              accountId,
              characterId,
              incomingName,
              incomingClassId,
              incomingLevel,
              inventoryAuthority,
              allowCreate,
              retryCount: attempts + 1,
            });
          }, 100);
        }
        return;
      }
      send(ws, { t: "EvRefuse", reason: "server_loading" });
      ws.close();
      return;
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
    const hasValidPosition = isValidSpawnTile(
      player.mapId,
      character.posX,
      character.posY
    );
    if (hasValidPosition) {
      player.x = character.posX;
      player.y = character.posY;
    } else {
      const spawn = resolveSpawnPosition(player.mapId);
      if (spawn && spawn.mapId) {
        player.mapId = spawn.mapId;
      }
      if (spawn && Number.isFinite(spawn.posX) && Number.isFinite(spawn.posY)) {
        player.x = spawn.posX;
        player.y = spawn.posY;
        if (characterStore) {
          character = characterStore.upsertCharacter({
            ...character,
            mapId: player.mapId,
            posX: player.x,
            posY: player.y,
          });
        }
      }
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
          : "invalid";
    const sessionToken =
      typeof msg.sessionToken === "string" ? msg.sessionToken : null;
    const sessionAccountId =
      typeof getAccountIdFromSession === "function"
        ? getAccountIdFromSession(sessionToken)
        : null;
    const hasSession = !!sessionAccountId;
    let accountId = null;

    const hasCredentials = !!(accountName && accountPassword);
    const now = Date.now();
    const ipKey = ws?._socket?.remoteAddress || "unknown";
    const accountKey = normalizeAccountName(accountName);
    const ipBucket = getBucket(authRateByIp, ipKey, now);
    const accountBucket = getBucket(authRateByAccount, accountKey, now);
    const ipBlocked = checkRateLimit(ipBucket, now);
    if (ipBlocked) {
      send(ws, { t: "EvRefuse", reason: ipBlocked });
      ws.close();
      return;
    }
    const accountBlocked = checkRateLimit(accountBucket, now);
    if (accountBlocked) {
      send(ws, { t: "EvRefuse", reason: accountBlocked });
      ws.close();
      return;
    }
    noteAttempt(ipBucket, now);
    noteAttempt(accountBucket, now);

    if (!accountStore) {
      send(ws, { t: "EvRefuse", reason: "auth_unavailable" });
      ws.close();
      return;
    }
    if (hasSession) {
      accountId = sessionAccountId;
      registerSuccess(ipBucket, now);
      registerSuccess(accountBucket, now);
    } else {
      if (!hasCredentials) {
        send(ws, { t: "EvRefuse", reason: "auth_required" });
        registerFailure(ipBucket, now);
        registerFailure(accountBucket, now);
        ws.close();
        return;
      }
      if (authMode === "invalid") {
        send(ws, { t: "EvRefuse", reason: "auth_mode_invalid" });
        registerFailure(ipBucket, now);
        registerFailure(accountBucket, now);
        ws.close();
        return;
      }
      if (!isValidAccountName(accountName)) {
        send(ws, { t: "EvRefuse", reason: "invalid_identifier" });
        registerFailure(ipBucket, now);
        registerFailure(accountBucket, now);
        ws.close();
        return;
      }
      if (!isValidPassword(accountPassword)) {
        send(ws, { t: "EvRefuse", reason: "invalid_password" });
        registerFailure(ipBucket, now);
        registerFailure(accountBucket, now);
        ws.close();
        return;
      }
      const existingAccount = accountStore.getAccountByName(accountName);
      if (authMode === "register") {
        if (existingAccount) {
          send(ws, { t: "EvRefuse", reason: "account_exists" });
          registerFailure(ipBucket, now);
          registerFailure(accountBucket, now);
          ws.close();
          return;
        }
        const created = accountStore.createAccount({
          name: accountName,
          password: accountPassword,
        });
        if (!created) {
          send(ws, { t: "EvRefuse", reason: "auth_failed" });
          registerFailure(ipBucket, now);
          registerFailure(accountBucket, now);
          ws.close();
          return;
        }
        accountId = created.accountId;
      } else if (authMode === "login") {
        if (!existingAccount) {
          send(ws, { t: "EvRefuse", reason: "account_missing" });
          registerFailure(ipBucket, now);
          registerFailure(accountBucket, now);
          ws.close();
          return;
        }
        const ok = accountStore.verifyPassword(existingAccount, accountPassword);
        if (!ok) {
          send(ws, { t: "EvRefuse", reason: "auth_failed" });
          registerFailure(ipBucket, now);
          registerFailure(accountBucket, now);
          ws.close();
          return;
        }
        accountId = existingAccount.accountId;
      } else {
        send(ws, { t: "EvRefuse", reason: "auth_mode_invalid" });
        registerFailure(ipBucket, now);
        registerFailure(accountBucket, now);
        ws.close();
        return;
      }
    }
    registerSuccess(ipBucket, now);
    registerSuccess(accountBucket, now);

    if (!characterStore) {
      send(ws, { t: "EvRefuse", reason: "character_required" });
      ws.close();
      return;
    }

    const requestCharacters = msg.requestCharacters === true;
    const requestedCharacterId =
      typeof msg.characterId === "string" ? msg.characterId : null;
    const incomingName = typeof msg.characterName === "string" ? msg.characterName : null;
    const incomingClassId = typeof msg.classId === "string" ? msg.classId : null;
    const incomingLevel = Number.isInteger(msg.level) ? msg.level : null;

    if (requestCharacters) {
      sendAccountCharacters(ws, accountId);
      return;
    }

    const accountCharacter =
      typeof characterStore.getCharacterByAccountId === "function"
        ? characterStore.getCharacterByAccountId(accountId)
        : null;
    const characterId = requestedCharacterId || accountCharacter?.characterId || null;
    if (!characterId) {
      sendAccountCharacters(ws, accountId);
      return;
    }

    handleCharacterLogin({
      ws,
      accountId,
      characterId,
      incomingName,
      incomingClassId,
      incomingLevel,
      inventoryAuthority,
      allowCreate: true,
    });
    return;
  }

  function handleCmdAccountSelectCharacter(ws, msg) {
    const sessionToken =
      typeof msg.sessionToken === "string" ? msg.sessionToken : null;
    const accountId =
      typeof getAccountIdFromSession === "function"
        ? getAccountIdFromSession(sessionToken)
        : null;
    if (!accountId) {
      send(ws, { t: "EvRefuse", reason: "auth_required" });
      return;
    }
    if (!characterStore) {
      send(ws, { t: "EvRefuse", reason: "character_required" });
      return;
    }
    const characterId =
      typeof msg.characterId === "string" ? msg.characterId : null;
    if (!characterId) {
      send(ws, { t: "EvRefuse", reason: "character_required" });
      return;
    }
    const character = characterStore.getCharacter(characterId);
    if (!character) {
      send(ws, { t: "EvRefuse", reason: "character_missing" });
      return;
    }
    if (character.accountId && character.accountId !== accountId) {
      send(ws, { t: "EvRefuse", reason: "character_owned" });
      return;
    }
    const inventoryAuthority = msg.inventoryAuthority === true;
    handleCharacterLogin({
      ws,
      accountId,
      characterId,
      incomingName: null,
      incomingClassId: null,
      incomingLevel: null,
      inventoryAuthority,
      allowCreate: false,
    });
  }

  function handleCmdAccountCreateCharacter(ws, msg) {
    const sessionToken =
      typeof msg.sessionToken === "string" ? msg.sessionToken : null;
    const accountId =
      typeof getAccountIdFromSession === "function"
        ? getAccountIdFromSession(sessionToken)
        : null;
    if (!accountId) {
      send(ws, { t: "EvRefuse", reason: "auth_required" });
      return;
    }
    if (!characterStore || typeof buildBaseStatsForClass !== "function") {
      send(ws, { t: "EvAccountCreateFailed", reason: "server_loading" });
      return;
    }
    const rawName = typeof msg.name === "string" ? msg.name : "";
    const name = rawName.trim();
    if (!name || name.length < 2 || name.length > 16) {
      send(ws, { t: "EvAccountCreateFailed", reason: "invalid_name" });
      return;
    }
    if (typeof characterStore.getCharacterByName === "function") {
      const existing = characterStore.getCharacterByName(name);
      if (existing) {
        send(ws, { t: "EvAccountCreateFailed", reason: "name_in_use" });
        return;
      }
    }
    const classId = typeof msg.classId === "string" ? msg.classId : "archer";
    const baseStats = buildBaseStatsForClass(classId || "archer");
    const characterId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : null;
    const id =
      characterId ||
      (typeof require === "function"
        ? require("crypto").randomBytes(16).toString("hex")
        : String(Date.now()));
    const spawn = resolveSpawnPosition(state.mapId);
    const created = characterStore.upsertCharacter({
      characterId: id,
      accountId,
      name,
      classId: classId || "archer",
      level: 1,
      baseStats,
      mapId: spawn?.mapId || state.mapId,
      posX: Number.isFinite(spawn?.posX) ? spawn.posX : null,
      posY: Number.isFinite(spawn?.posY) ? spawn.posY : null,
    });
    if (!created) {
      send(ws, { t: "EvAccountCreateFailed", reason: "create_failed" });
      return;
    }
    sendAccountCharacters(ws, accountId);
  }

  function handleCmdAccountDeleteCharacter(ws, msg) {
    const sessionToken =
      typeof msg.sessionToken === "string" ? msg.sessionToken : null;
    const accountId =
      typeof getAccountIdFromSession === "function"
        ? getAccountIdFromSession(sessionToken)
        : null;
    if (!accountId) {
      send(ws, { t: "EvRefuse", reason: "auth_required" });
      return;
    }
    if (!characterStore || typeof characterStore.deleteCharacter !== "function") {
      send(ws, { t: "EvAccountDeleteFailed", reason: "server_loading" });
      return;
    }
    const characterId =
      typeof msg.characterId === "string" ? msg.characterId : null;
    if (!characterId) {
      send(ws, { t: "EvAccountDeleteFailed", reason: "character_required" });
      return;
    }
    const character = characterStore.getCharacter(characterId);
    if (!character) {
      send(ws, { t: "EvAccountDeleteFailed", reason: "character_missing" });
      return;
    }
    if (character.accountId && character.accountId !== accountId) {
      send(ws, { t: "EvAccountDeleteFailed", reason: "character_owned" });
      return;
    }
    const online = Object.values(state.players).some(
      (p) => p && p.characterId === characterId && p.connected !== false
    );
    if (online) {
      send(ws, { t: "EvAccountDeleteFailed", reason: "character_in_use" });
      return;
    }
    const ok = characterStore.deleteCharacter(characterId);
    if (!ok) {
      send(ws, { t: "EvAccountDeleteFailed", reason: "delete_failed" });
      return;
    }
    sendAccountCharacters(ws, accountId);
  }

  return {
    handleHello,
    handleCmdAccountSelectCharacter,
    handleCmdAccountCreateCharacter,
    handleCmdAccountDeleteCharacter,
  };
}

module.exports = {
  createAuthHandlers,
};
