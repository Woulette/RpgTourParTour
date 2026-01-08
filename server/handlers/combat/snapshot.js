function createSnapshotHandlers(ctx, helpers) {
  const {
    state,
    broadcast,
    getMonsterDef,
    getCombatPattern,
    getCombatStartPositions,
    serializeActorOrder,
  } = ctx;
  const { collectCombatMobEntries } = helpers;

  function mergeCombatSnapshot(prev, incoming) {
    const prevPlayers = Array.isArray(prev?.players) ? prev.players : [];
    const prevMonsters = Array.isArray(prev?.monsters) ? prev.monsters : [];
    const prevSummons = Array.isArray(prev?.summons) ? prev.summons : [];
    const nextPlayers = Array.isArray(incoming?.players) ? incoming.players : [];
    const nextMonsters = Array.isArray(incoming?.monsters) ? incoming.monsters : [];
    const nextSummons = Array.isArray(incoming?.summons) ? incoming.summons : [];

    const playerMap = new Map();
    prevPlayers.forEach((p) => {
      if (!p || !Number.isInteger(p.playerId)) return;
      playerMap.set(p.playerId, p);
    });

    const mergedPlayers = nextPlayers.map((p) => {
      if (!p || !Number.isInteger(p.playerId)) return p;
      const prevEntry = playerMap.get(p.playerId) || null;
      if (!prevEntry) return p;
      return {
        ...p,
        hp: Number.isFinite(prevEntry.hp) ? prevEntry.hp : p.hp,
        hpMax: Number.isFinite(prevEntry.hpMax) ? prevEntry.hpMax : p.hpMax,
        capturedMonsterId:
          typeof prevEntry.capturedMonsterId === "string"
            ? prevEntry.capturedMonsterId
            : p.capturedMonsterId,
        capturedMonsterLevel:
          Number.isFinite(prevEntry.capturedMonsterLevel)
            ? prevEntry.capturedMonsterLevel
            : p.capturedMonsterLevel,
        statusEffects: Array.isArray(prevEntry.statusEffects)
          ? prevEntry.statusEffects
          : p.statusEffects,
      };
    });

    const monsterMap = new Map();
    prevMonsters.forEach((m, idx) => {
      if (!m) return;
      const key = Number.isInteger(m.entityId)
        ? `id:${m.entityId}`
        : Number.isInteger(m.combatIndex)
          ? `idx:${m.combatIndex}`
          : `pos:${idx}`;
      monsterMap.set(key, m);
    });

    const mergedMonsters = nextMonsters.map((m, idx) => {
      if (!m) return m;
      const key = Number.isInteger(m.entityId)
        ? `id:${m.entityId}`
        : Number.isInteger(m.combatIndex)
          ? `idx:${m.combatIndex}`
          : `pos:${idx}`;
      const prevEntry = monsterMap.get(key) || null;
      if (!prevEntry) return m;
      return {
        ...m,
        hp: Number.isFinite(prevEntry.hp) ? prevEntry.hp : m.hp,
        hpMax: Number.isFinite(prevEntry.hpMax) ? prevEntry.hpMax : m.hpMax,
        level: Number.isInteger(prevEntry.level) ? prevEntry.level : m.level,
        statusEffects: Array.isArray(prevEntry.statusEffects)
          ? prevEntry.statusEffects
          : m.statusEffects,
      };
    });

    const summonMap = new Map();
    prevSummons.forEach((s, idx) => {
      if (!s) return;
      const key = Number.isInteger(s.summonId) ? `id:${s.summonId}` : `pos:${idx}`;
      summonMap.set(key, s);
    });

    const mergedSummons = nextSummons.map((s, idx) => {
      if (!s) return s;
      const key = Number.isInteger(s.summonId) ? `id:${s.summonId}` : `pos:${idx}`;
      const prevEntry = summonMap.get(key) || null;
      if (!prevEntry) return s;
      return {
        ...s,
        hp: Number.isFinite(prevEntry.hp) ? prevEntry.hp : s.hp,
        hpMax: Number.isFinite(prevEntry.hpMax) ? prevEntry.hpMax : s.hpMax,
        statusEffects: Array.isArray(prevEntry.statusEffects)
          ? prevEntry.statusEffects
          : s.statusEffects,
      };
    });

    return {
      players: mergedPlayers,
      monsters: mergedMonsters,
      summons: mergedSummons,
      updatedAt: prev?.updatedAt ?? null,
    };
  }

  function computePlacementTiles(meta, originX, originY, offsets) {
    const tiles = [];
    if (!meta || !Number.isInteger(meta.width) || !Number.isInteger(meta.height)) {
      return tiles;
    }
    if (!offsets || !Array.isArray(offsets) || offsets.length === 0) {
      if (
        Number.isInteger(originX) &&
        Number.isInteger(originY) &&
        originX >= 0 &&
        originX < meta.width &&
        originY >= 0 &&
        originY < meta.height
      ) {
        tiles.push({ x: originX, y: originY });
      }
      return tiles;
    }

    offsets.forEach((off) => {
      if (!off || !Number.isInteger(off.x) || !Number.isInteger(off.y)) return;
      const tx = originX + off.x;
      const ty = originY + off.y;
      if (tx < 0 || ty < 0 || tx >= meta.width || ty >= meta.height) return;
      tiles.push({ x: tx, y: ty });
    });

    if (tiles.length === 0) {
      if (
        Number.isInteger(originX) &&
        Number.isInteger(originY) &&
        originX >= 0 &&
        originX < meta.width &&
        originY >= 0 &&
        originY < meta.height
      ) {
        tiles.push({ x: originX, y: originY });
      }
    }
    return tiles;
  }

  function resolveCombatPlacement(combat) {
    if (!combat || !combat.mapId) return null;
    const meta = state.mapMeta[combat.mapId];
    if (!meta) return null;
    const patternId = "close_melee";
    const pattern = getCombatPattern ? getCombatPattern(patternId) : null;
    if (!pattern) return null;

    let playerOriginX = Number.isInteger(combat.tileX) ? combat.tileX : null;
    let playerOriginY = Number.isInteger(combat.tileY) ? combat.tileY : null;
    let enemyOriginX = playerOriginX;
    let enemyOriginY = playerOriginY;

    const mapAnchors = getCombatStartPositions ? getCombatStartPositions(combat.mapId) : null;
    const anchorsForPattern = mapAnchors ? mapAnchors[patternId] : null;
    if (Array.isArray(anchorsForPattern) && anchorsForPattern.length > 0) {
      const idx =
        Number.isInteger(combat.id)
          ? Math.abs(combat.id) % anchorsForPattern.length
          : 0;
      const anchor = anchorsForPattern[idx];
      if (anchor?.playerOrigin && anchor?.enemyOrigin) {
        playerOriginX = anchor.playerOrigin.x;
        playerOriginY = anchor.playerOrigin.y;
        enemyOriginX = anchor.enemyOrigin.x;
        enemyOriginY = anchor.enemyOrigin.y;
      }
    }

    if (!Number.isInteger(enemyOriginX) || !Number.isInteger(enemyOriginY)) {
      const mobEntries = collectCombatMobEntries(combat);
      const leader = mobEntries[0] || null;
      if (leader) {
        enemyOriginX = Number.isInteger(leader.tileX) ? leader.tileX : enemyOriginX;
        enemyOriginY = Number.isInteger(leader.tileY) ? leader.tileY : enemyOriginY;
        if (!Number.isInteger(playerOriginX)) playerOriginX = enemyOriginX;
        if (!Number.isInteger(playerOriginY)) playerOriginY = enemyOriginY;
      }
    }

    if (!Number.isInteger(playerOriginX) || !Number.isInteger(playerOriginY)) return null;

    const playerTiles = computePlacementTiles(
      meta,
      playerOriginX,
      playerOriginY,
      pattern.playerOffsets
    );
    const enemyTiles = computePlacementTiles(
      meta,
      enemyOriginX,
      enemyOriginY,
      pattern.enemyOffsets
    );

    if (playerTiles.length === 0 || enemyTiles.length === 0) return null;

    return { playerTiles, enemyTiles };
  }

  function applyCombatPlacement(combat) {
    const placement = resolveCombatPlacement(combat);
    if (!placement) return;
    const { playerTiles, enemyTiles } = placement;
    if (!combat.stateSnapshot) return;

    const participants = Array.isArray(combat.participantIds)
      ? combat.participantIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id))
          .sort((a, b) => a - b)
      : [];
    participants.forEach((playerId, idx) => {
      const requested = combat.prepPlacements && combat.prepPlacements[playerId];
      const tile =
        (requested &&
          Number.isInteger(requested.x) &&
          Number.isInteger(requested.y) &&
          playerTiles.some((t) => t.x === requested.x && t.y === requested.y) &&
          requested) ||
        playerTiles[idx] ||
        playerTiles[playerTiles.length - 1];
      if (!tile) return;
      const entry =
        combat.stateSnapshot.players.find((p) => p && p.playerId === playerId) || null;
      if (!entry) return;
      const player = state.players[playerId];
      const hasManualPlacement =
        player && Number.isInteger(player.lastCombatMoveSeq) && player.lastCombatMoveSeq > 0;
      if (!hasManualPlacement || entry.tileX === null || entry.tileY === null) {
        entry.tileX = tile.x;
        entry.tileY = tile.y;
        if (player) {
          player.x = tile.x;
          player.y = tile.y;
        }
      }
    });

    const mobEntries = collectCombatMobEntries(combat);
    mobEntries.forEach((entry, idx) => {
      const tile = enemyTiles[idx] || enemyTiles[enemyTiles.length - 1];
      if (!tile || !entry) return;
      entry.tileX = tile.x;
      entry.tileY = tile.y;
      upsertSnapshotMonster(combat, {
        entityId: Number.isInteger(entry.entityId) ? entry.entityId : null,
        combatIndex: Number.isInteger(entry.combatIndex) ? entry.combatIndex : idx,
        monsterId: entry.monsterId,
        tileX: tile.x,
        tileY: tile.y,
      });
    });

    combat.stateSnapshot.updatedAt = Date.now();
  }

  function getMonsterBaseHp(monsterId) {
    const def = typeof getMonsterDef === "function" ? getMonsterDef(monsterId) : null;
    const overrides = def?.statsOverrides || {};
    const hpMax = Number.isFinite(overrides.hpMax)
      ? overrides.hpMax
      : Number.isFinite(overrides.hp)
        ? overrides.hp
        : 50;
    const hp = Number.isFinite(overrides.hp) ? overrides.hp : hpMax;
    return { hp, hpMax };
  }

  function ensureCombatSnapshot(combat) {
    if (!combat) return null;
    if (combat.stateSnapshot) {
      return combat.stateSnapshot;
    }
    const players = [];
    const participants = Array.isArray(combat.participantIds) ? combat.participantIds : [];
    participants.forEach((id) => {
      const player = state.players[id];
      if (!player) return;
      const hp =
        Number.isFinite(player.hp) ? player.hp : Number.isFinite(player.hpMax) ? player.hpMax : 50;
      const hpMax =
        Number.isFinite(player.hpMax) ? player.hpMax : Number.isFinite(player.hp) ? player.hp : 50;
      players.push({
        playerId: player.id,
        tileX: Number.isInteger(player.x) ? player.x : null,
        tileY: Number.isInteger(player.y) ? player.y : null,
        hp,
        hpMax,
        classId: typeof player.classId === "string" ? player.classId : null,
        displayName:
          typeof player.displayName === "string"
            ? player.displayName
            : typeof player.name === "string"
              ? player.name
              : null,
        capturedMonsterId: typeof player.capturedMonsterId === "string" ? player.capturedMonsterId : null,
        capturedMonsterLevel: Number.isFinite(player.capturedMonsterLevel)
          ? player.capturedMonsterLevel
          : null,
        statusEffects: Array.isArray(player.statusEffects)
          ? player.statusEffects.slice()
          : [],
      });
    });

    const mobEntries = collectCombatMobEntries(combat);
    const monsters = mobEntries.map((entry, idx) => {
      const stats = getMonsterBaseHp(entry?.monsterId);
      return {
        combatIndex: Number.isInteger(entry?.combatIndex) ? entry.combatIndex : idx,
        entityId: Number.isInteger(entry?.entityId) ? entry.entityId : null,
        monsterId: typeof entry?.monsterId === "string" ? entry.monsterId : null,
        level: Number.isInteger(entry?.level) ? entry.level : null,
        tileX: Number.isInteger(entry?.tileX) ? entry.tileX : null,
        tileY: Number.isInteger(entry?.tileY) ? entry.tileY : null,
        hp: stats.hp,
        hpMax: stats.hpMax,
        statusEffects: [],
      };
    });

    const summons = Array.isArray(combat.summons)
      ? combat.summons.map((s) => ({ ...s }))
      : [];

    combat.stateSnapshot = { players, monsters, summons, updatedAt: Date.now() };
    return combat.stateSnapshot;
  }

  function upsertSnapshotPlayer(combat, playerId) {
    if (!combat || !Number.isInteger(playerId)) return;
    const snapshot = ensureCombatSnapshot(combat);
    if (!snapshot) return;
    const player = state.players[playerId];
    if (!player) return;
    const hp =
      Number.isFinite(player.hp) ? player.hp : Number.isFinite(player.hpMax) ? player.hpMax : 50;
    const hpMax =
      Number.isFinite(player.hpMax) ? player.hpMax : Number.isFinite(player.hp) ? player.hp : 50;
    let entry = snapshot.players.find((p) => p && p.playerId === playerId) || null;
    if (!entry) {
      entry = {
        playerId,
        tileX: Number.isInteger(player.x) ? player.x : null,
        tileY: Number.isInteger(player.y) ? player.y : null,
        hp,
        hpMax,
        classId: typeof player.classId === "string" ? player.classId : null,
        displayName:
          typeof player.displayName === "string"
            ? player.displayName
            : typeof player.name === "string"
              ? player.name
              : null,
        capturedMonsterId: typeof player.capturedMonsterId === "string" ? player.capturedMonsterId : null,
        capturedMonsterLevel: Number.isFinite(player.capturedMonsterLevel)
          ? player.capturedMonsterLevel
          : null,
        statusEffects: Array.isArray(player.statusEffects)
          ? player.statusEffects.slice()
          : [],
      };
      snapshot.players.push(entry);
    } else {
      entry.tileX = Number.isInteger(player.x) ? player.x : entry.tileX;
      entry.tileY = Number.isInteger(player.y) ? player.y : entry.tileY;
      entry.hp = hp;
      entry.hpMax = hpMax;
      if (typeof player.classId === "string" && player.classId) {
        entry.classId = player.classId;
      }
      if (typeof player.displayName === "string" && player.displayName) {
        entry.displayName = player.displayName;
      } else if (typeof player.name === "string" && player.name) {
        entry.displayName = player.name;
      }
      if (typeof player.capturedMonsterId === "string") {
        entry.capturedMonsterId = player.capturedMonsterId;
      }
      if (Number.isFinite(player.capturedMonsterLevel)) {
        entry.capturedMonsterLevel = player.capturedMonsterLevel;
      }
      if (Array.isArray(player.statusEffects)) {
        entry.statusEffects = player.statusEffects.slice();
      }
    }
    snapshot.updatedAt = Date.now();
  }

  function upsertSnapshotMonster(combat, data) {
    if (!combat || !data) return;
    const snapshot = ensureCombatSnapshot(combat);
    if (!snapshot) return;
    const entityId = Number.isInteger(data.entityId) ? data.entityId : null;
    const combatIndex = Number.isInteger(data.combatIndex) ? data.combatIndex : null;
    let entry =
      (entityId !== null
        ? snapshot.monsters.find((m) => m && m.entityId === entityId)
        : null) ||
      (combatIndex !== null
        ? snapshot.monsters.find((m) => m && m.combatIndex === combatIndex)
        : null) ||
      null;

    if (!entry) {
      const mobEntries = Array.isArray(combat.mobEntries) ? combat.mobEntries : [];
      const source =
        (entityId !== null
          ? mobEntries.find((m) => m && m.entityId === entityId)
          : null) ||
        (combatIndex !== null
          ? mobEntries.find((m) => m && m.combatIndex === combatIndex)
          : null) ||
        null;
      const stats = getMonsterBaseHp(source?.monsterId || data.monsterId);
      entry = {
        combatIndex: combatIndex ?? source?.combatIndex ?? null,
        entityId: entityId ?? source?.entityId ?? null,
        monsterId:
          typeof data.monsterId === "string"
            ? data.monsterId
            : typeof source?.monsterId === "string"
              ? source.monsterId
              : null,
        level: Number.isInteger(data.level)
          ? data.level
          : Number.isInteger(source?.level)
            ? source.level
            : null,
        tileX: Number.isInteger(data.tileX)
          ? data.tileX
          : Number.isInteger(source?.tileX)
            ? source.tileX
            : null,
        tileY: Number.isInteger(data.tileY)
          ? data.tileY
          : Number.isInteger(source?.tileY)
            ? source.tileY
            : null,
        hp: stats.hp,
        hpMax: stats.hpMax,
        statusEffects: Array.isArray(source?.statusEffects)
          ? source.statusEffects.slice()
          : [],
      };
      snapshot.monsters.push(entry);
    } else {
      if (Number.isInteger(data.tileX)) entry.tileX = data.tileX;
      if (Number.isInteger(data.tileY)) entry.tileY = data.tileY;
      if (Number.isFinite(data.hp)) entry.hp = data.hp;
      if (Number.isFinite(data.hpMax)) entry.hpMax = data.hpMax;
      if (Number.isInteger(data.level)) entry.level = data.level;
    }
    snapshot.updatedAt = Date.now();
  }

  function upsertSnapshotSummon(combat, data) {
    if (!combat || !data) return;
    const snapshot = ensureCombatSnapshot(combat);
    if (!snapshot) return;
    snapshot.summons = Array.isArray(snapshot.summons) ? snapshot.summons : [];
    const summonId = Number.isInteger(data.summonId) ? data.summonId : null;
    let entry =
      (summonId !== null
        ? snapshot.summons.find((s) => s && s.summonId === summonId)
        : null) || null;
    if (!entry) {
      entry = {
        summonId,
        ownerPlayerId: Number.isInteger(data.ownerPlayerId) ? data.ownerPlayerId : null,
        monsterId: typeof data.monsterId === "string" ? data.monsterId : null,
        tileX: Number.isInteger(data.tileX) ? data.tileX : null,
        tileY: Number.isInteger(data.tileY) ? data.tileY : null,
        hp: Number.isFinite(data.hp) ? data.hp : 0,
        hpMax: Number.isFinite(data.hpMax) ? data.hpMax : 0,
        level: Number.isFinite(data.level) ? data.level : 1,
        statusEffects: Array.isArray(data.statusEffects) ? data.statusEffects.slice() : [],
      };
      snapshot.summons.push(entry);
    } else {
      if (Number.isInteger(data.tileX)) entry.tileX = data.tileX;
      if (Number.isInteger(data.tileY)) entry.tileY = data.tileY;
      if (Number.isFinite(data.hp)) entry.hp = data.hp;
      if (Number.isFinite(data.hpMax)) entry.hpMax = data.hpMax;
      if (Number.isFinite(data.level)) entry.level = data.level;
      if (Array.isArray(data.statusEffects)) entry.statusEffects = data.statusEffects.slice();
    }
    snapshot.updatedAt = Date.now();
  }

  function applyDamageToCombatSnapshot(combat, payload) {
    if (!combat || !combat.stateSnapshot) return;
    const { damage } = payload || {};
    if (!Number.isFinite(damage) || damage <= 0) return;
    const monsters = Array.isArray(combat.stateSnapshot.monsters)
      ? combat.stateSnapshot.monsters
      : [];
    const players = Array.isArray(combat.stateSnapshot.players)
      ? combat.stateSnapshot.players
      : [];
    const summons = Array.isArray(combat.stateSnapshot.summons)
      ? combat.stateSnapshot.summons
      : [];

    let target = null;
    if (payload.targetKind === "monster") {
      if (Number.isInteger(payload.targetId)) {
        target = monsters.find((m) => m && m.entityId === payload.targetId) || null;
      }
      if (!target && Number.isInteger(payload.targetIndex)) {
        target = monsters[payload.targetIndex] || null;
      }
    } else if (payload.targetKind === "player") {
      if (Number.isInteger(payload.targetId)) {
        target = players.find((p) => p && p.playerId === payload.targetId) || null;
      }
    } else if (payload.targetKind === "summon") {
      if (Number.isInteger(payload.targetId)) {
        target = summons.find((s) => s && s.summonId === payload.targetId) || null;
      }
    }
    if (!target && Number.isInteger(payload.targetX) && Number.isInteger(payload.targetY)) {
      target =
        monsters.find(
          (m) =>
            m &&
            Number.isInteger(m.tileX) &&
            Number.isInteger(m.tileY) &&
            m.tileX === payload.targetX &&
            m.tileY === payload.targetY
        ) || null;
      if (!target) {
        target =
          players.find(
            (p) =>
              p &&
              Number.isInteger(p.tileX) &&
              Number.isInteger(p.tileY) &&
              p.tileX === payload.targetX &&
              p.tileY === payload.targetY
          ) || null;
      }
      if (!target) {
        target =
          summons.find(
            (s) =>
              s &&
              Number.isInteger(s.tileX) &&
              Number.isInteger(s.tileY) &&
              s.tileX === payload.targetX &&
              s.tileY === payload.targetY
          ) || null;
      }
    }
    if (!target) return;

    const hp =
      Number.isFinite(target.hp) ? target.hp : Number.isFinite(target.hpMax) ? target.hpMax : 0;
    const hpMax =
      Number.isFinite(target.hpMax) ? target.hpMax : Number.isFinite(target.hp) ? target.hp : 0;
    const newHp = Math.max(0, hp - damage);
    target.hp = newHp;
    target.hpMax = hpMax;

    if (payload.targetKind === "player" && Number.isInteger(payload.targetId)) {
      const player = state.players[payload.targetId];
      if (player) {
        player.hp = newHp;
      }
    }
  }

  function handleCmdCombatState(clientInfo, msg) {
    if (!clientInfo || !Number.isInteger(clientInfo.id)) return;
    const combatId = Number.isInteger(msg.combatId) ? msg.combatId : null;
    if (!combatId) return;
    const combat = state.combats[combatId];
    if (!combat) return;
    if (
      !Array.isArray(combat.participantIds) ||
      !combat.participantIds.includes(clientInfo.id)
    ) {
      return;
    }
    if (combat.stateSnapshotLocked) return;
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (!mapId || mapId !== combat.mapId) return;

    const players = Array.isArray(msg.players) ? msg.players : [];
    const monsters = Array.isArray(msg.monsters) ? msg.monsters : [];
    const summons = Array.isArray(msg.summons) ? msg.summons : [];

    combat.stateSnapshot = mergeCombatSnapshot(combat.stateSnapshot, {
      players,
      monsters,
      summons,
    });
    combat.stateSnapshot.updatedAt = Date.now();

    const snapshotPlayers = Array.isArray(combat.stateSnapshot?.players)
      ? combat.stateSnapshot.players
      : players;
    const snapshotMonsters = Array.isArray(combat.stateSnapshot?.monsters)
      ? combat.stateSnapshot.monsters
      : monsters;
    const snapshotSummons = Array.isArray(combat.stateSnapshot?.summons)
      ? combat.stateSnapshot.summons
      : summons;

    combat.stateSnapshotLocked = true;

    broadcast({
      t: "EvCombatState",
      combatId,
      mapId,
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
      actorOrder: serializeActorOrder ? serializeActorOrder(combat) : undefined,
      players: snapshotPlayers,
      monsters: snapshotMonsters,
      summons: snapshotSummons,
    });
  }

  return {
    mergeCombatSnapshot,
    ensureCombatSnapshot,
    upsertSnapshotPlayer,
    upsertSnapshotMonster,
    upsertSnapshotSummon,
    applyDamageToCombatSnapshot,
    applyCombatPlacement,
    resolveCombatPlacement,
    handleCmdCombatState,
  };
}

module.exports = {
  createSnapshotHandlers,
};
