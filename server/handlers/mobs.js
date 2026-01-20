function createMobHandlers(ctx) {
  const {
    state,
    broadcast,
    send,
    getNextEventId,
    getNextMonsterEntityId,
    getHostId,
    ensureMapInitialized,
    monsterMoveTimers,
    monsterRespawnTimers,
    config,
  } = ctx;

  const MONSTER_STEP_DURATION_MS = config.MONSTER_STEP_DURATION_MS;
  const MOB_RESPAWN_DELAY_MS = config.MOB_RESPAWN_DELAY_MS;

  function sanitizeMonsterEntries(raw) {
    if (!Array.isArray(raw)) return [];
    const result = [];
    const maxMonsters = 300;
    const maxGroupSize = 12;
    const maxPoolSize = 12;

    for (const entry of raw) {
      if (!entry || typeof entry.monsterId !== "string") continue;
      const tileX = Number.isInteger(entry.tileX) ? entry.tileX : null;
      const tileY = Number.isInteger(entry.tileY) ? entry.tileY : null;
      if (tileX === null || tileY === null) continue;

      const groupMonsterIds = Array.isArray(entry.groupMonsterIds)
        ? entry.groupMonsterIds.filter((id) => typeof id === "string").slice(0, maxGroupSize)
        : null;
      const groupLevels = Array.isArray(entry.groupLevels)
        ? entry.groupLevels
            .map((lvl) => (Number.isInteger(lvl) ? lvl : null))
            .filter((lvl) => lvl !== null)
            .slice(0, maxGroupSize)
        : null;

      const groupSize = Number.isInteger(entry.groupSize)
        ? Math.max(1, entry.groupSize)
        : groupMonsterIds
          ? groupMonsterIds.length
          : 1;
      const level = Number.isInteger(entry.level)
        ? entry.level
        : groupLevels && groupLevels.length > 0
          ? groupLevels[0]
          : null;

      const respawnTemplate =
        entry.respawnTemplate && typeof entry.respawnTemplate === "object"
          ? {
              groupPool: Array.isArray(entry.respawnTemplate.groupPool)
                ? entry.respawnTemplate.groupPool
                    .filter((id) => typeof id === "string")
                    .slice(0, maxPoolSize)
                : [],
              groupSizeMin: Number.isInteger(entry.respawnTemplate.groupSizeMin)
                ? entry.respawnTemplate.groupSizeMin
                : null,
              groupSizeMax: Number.isInteger(entry.respawnTemplate.groupSizeMax)
                ? entry.respawnTemplate.groupSizeMax
                : null,
              forceMixedGroup: entry.respawnTemplate.forceMixedGroup === true,
            }
          : null;

      result.push({
        monsterId: entry.monsterId,
        tileX,
        tileY,
        groupId: Number.isInteger(entry.groupId) ? entry.groupId : null,
        groupSize,
        groupMonsterIds,
        groupLevels,
        groupLevelTotal: Number.isInteger(entry.groupLevelTotal) ? entry.groupLevelTotal : null,
        level,
        respawnTemplate,
      });

      if (result.length >= maxMonsters) break;
    }

    return result;
  }

  function serializeMonsterEntries(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((entry) => entry && typeof entry.monsterId === "string")
      .map((entry) => ({
        entityId: Number.isInteger(entry.entityId) ? entry.entityId : null,
        monsterId: entry.monsterId,
        tileX: Number.isInteger(entry.tileX) ? entry.tileX : null,
        tileY: Number.isInteger(entry.tileY) ? entry.tileY : null,
        combatIndex: Number.isInteger(entry.combatIndex) ? entry.combatIndex : null,
        groupId: Number.isInteger(entry.groupId) ? entry.groupId : null,
        groupSize: Number.isInteger(entry.groupSize) ? entry.groupSize : null,
        groupMonsterIds: Array.isArray(entry.groupMonsterIds)
          ? entry.groupMonsterIds.slice()
          : null,
        groupLevels: Array.isArray(entry.groupLevels) ? entry.groupLevels.slice() : null,
        groupLevelTotal: Number.isInteger(entry.groupLevelTotal)
          ? entry.groupLevelTotal
          : null,
        level: Number.isInteger(entry.level) ? entry.level : null,
        respawnTemplate:
          entry.respawnTemplate && typeof entry.respawnTemplate === "object"
            ? {
                groupPool: Array.isArray(entry.respawnTemplate.groupPool)
                  ? entry.respawnTemplate.groupPool.slice()
                  : [],
                groupSizeMin: Number.isInteger(entry.respawnTemplate.groupSizeMin)
                  ? entry.respawnTemplate.groupSizeMin
                  : null,
                groupSizeMax: Number.isInteger(entry.respawnTemplate.groupSizeMax)
                  ? entry.respawnTemplate.groupSizeMax
                  : null,
                forceMixedGroup: entry.respawnTemplate.forceMixedGroup === true,
              }
            : null,
        spawnMapKey: typeof entry.spawnMapKey === "string" ? entry.spawnMapKey : null,
      }));
  }

  function getVisibleMonstersForMap(mapId) {
    const list = state.mapMonsters[mapId];
    if (!Array.isArray(list)) return [];
    return list.filter((entry) => !entry || entry.inCombat !== true);
  }

  function sanitizeMobPath(raw, startX, startY, maxSteps = 8) {
    if (!Array.isArray(raw) || !Number.isInteger(startX) || !Number.isInteger(startY)) {
      return [];
    }
    const steps = [];
    let prevX = startX;
    let prevY = startY;

    for (const step of raw) {
      if (steps.length >= maxSteps) break;
      const x = Number.isInteger(step?.x) ? step.x : null;
      const y = Number.isInteger(step?.y) ? step.y : null;
      if (x === null || y === null) break;
      const dx = Math.abs(x - prevX);
      const dy = Math.abs(y - prevY);
      if (dx + dy !== 1) break;
      steps.push({ x, y });
      prevX = x;
      prevY = y;
    }

    return steps;
  }

  function handleCmdMapMonsters(ws, clientInfo, msg) {
    handleCmdRequestMapMonsters(ws, clientInfo, msg);
  }

  function handleCmdMobMoveStart(ws, clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    if (clientInfo.id !== getHostId()) return;
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (!mapId) return;
    const entityId = Number.isInteger(msg.entityId) ? msg.entityId : null;
    if (!entityId) return;

    const list = state.mapMonsters[mapId];
    if (!Array.isArray(list) || list.length === 0) return;
    const entry = list.find((m) => m && m.entityId === entityId);
    if (!entry) return;
    if (entry.inCombat) return;

    const seq = Number.isInteger(msg.seq) ? msg.seq : 0;
    const lastSeq = entry.lastMoveSeq || 0;
    if (seq <= lastSeq) return;
    entry.lastMoveSeq = seq;

    const path = sanitizeMobPath(msg.path, entry.tileX, entry.tileY, 8);
    if (path.length === 0) return;

    const last = path[path.length - 1];
    entry.tileX = last.x;
    entry.tileY = last.y;

    const prevTimer = monsterMoveTimers.get(entityId);
    if (prevTimer) clearTimeout(prevTimer);
    entry.isMoving = true;
    const timer = setTimeout(() => {
      entry.isMoving = false;
      broadcast({
        t: "EvMobMoveEnd",
        entityId,
        mapId,
        seq,
        toX: entry.tileX,
        toY: entry.tileY,
      });
    }, path.length * MONSTER_STEP_DURATION_MS);
    monsterMoveTimers.set(entityId, timer);

    broadcast({
      t: "EvMobMoveStart",
      entityId,
      mapId,
      seq,
      path,
      toX: entry.tileX,
      toY: entry.tileY,
    });
  }

  function scheduleMobRespawn(mapId, sourceEntry) {
    if (!mapId || !sourceEntry) return;
    const entityId = sourceEntry.entityId;
    if (monsterRespawnTimers.has(entityId)) {
      clearTimeout(monsterRespawnTimers.get(entityId));
      monsterRespawnTimers.delete(entityId);
    }

    const timer = setTimeout(() => {
      const list = state.mapMonsters[mapId];
      if (!Array.isArray(list)) return;

      const baseLevel =
        Number.isInteger(sourceEntry.level)
          ? sourceEntry.level
          : Array.isArray(sourceEntry.groupLevels) && sourceEntry.groupLevels.length > 0
          ? sourceEntry.groupLevels[0]
          : 1;

      const buildRespawnGroup = () => {
        const tpl = sourceEntry.respawnTemplate;
        const pool = Array.isArray(tpl?.groupPool) ? tpl.groupPool.filter(Boolean) : [];
        if (pool.length === 0) {
          return {
            monsterId: sourceEntry.monsterId,
            groupMonsterIds: Array.isArray(sourceEntry.groupMonsterIds)
              ? sourceEntry.groupMonsterIds.slice()
              : [sourceEntry.monsterId],
            groupSize: sourceEntry.groupSize ?? 1,
          };
        }

        const sizeMin =
          Number.isInteger(tpl.groupSizeMin) && tpl.groupSizeMin > 0
            ? tpl.groupSizeMin
            : 1;
        const sizeMax =
          Number.isInteger(tpl.groupSizeMax) && tpl.groupSizeMax > 0
            ? tpl.groupSizeMax
            : Math.max(1, sizeMin);
        const groupSize =
          sizeMin === sizeMax
            ? sizeMin
            : Math.floor(Math.random() * (Math.max(sizeMin, sizeMax) - Math.min(sizeMin, sizeMax) + 1)) +
              Math.min(sizeMin, sizeMax);

        const leaderId = pool[Math.floor(Math.random() * pool.length)];
        const groupMonsterIds = Array.from({ length: Math.max(1, groupSize) }, () => {
          return pool[Math.floor(Math.random() * pool.length)];
        });
        groupMonsterIds[0] = leaderId;

        if (tpl.forceMixedGroup === true && groupMonsterIds.length > 1) {
          const hasDistinct = new Set(groupMonsterIds).size > 1;
          if (!hasDistinct && pool.length > 1) {
            const alternatives = pool.filter((id) => id !== leaderId);
            if (alternatives.length > 0) {
              groupMonsterIds[1] =
                alternatives[Math.floor(Math.random() * alternatives.length)];
            }
          }
        }

        return { monsterId: leaderId, groupMonsterIds, groupSize: groupMonsterIds.length };
      };

      const respawnGroup = buildRespawnGroup();
      const groupLevels = Array.from(
        { length: Math.max(1, respawnGroup.groupSize) },
        () => baseLevel
      );

      const newEntry = {
        monsterId: respawnGroup.monsterId,
        tileX: Number.isInteger(sourceEntry.spawnTileX)
          ? sourceEntry.spawnTileX
          : sourceEntry.tileX,
        tileY: Number.isInteger(sourceEntry.spawnTileY)
          ? sourceEntry.spawnTileY
          : sourceEntry.tileY,
        groupId: sourceEntry.groupId ?? null,
        groupSize: respawnGroup.groupSize ?? 1,
        groupMonsterIds: respawnGroup.groupMonsterIds || [respawnGroup.monsterId],
        groupLevels,
        groupLevelTotal: groupLevels.reduce((sum, lvl) => sum + lvl, 0),
        level: baseLevel,
        respawnTemplate:
          sourceEntry.respawnTemplate && typeof sourceEntry.respawnTemplate === "object"
            ? {
                groupPool: Array.isArray(sourceEntry.respawnTemplate.groupPool)
                  ? sourceEntry.respawnTemplate.groupPool.slice()
                  : [],
                groupSizeMin: sourceEntry.respawnTemplate.groupSizeMin ?? null,
                groupSizeMax: sourceEntry.respawnTemplate.groupSizeMax ?? null,
                forceMixedGroup: sourceEntry.respawnTemplate.forceMixedGroup === true,
              }
            : null,
        spawnMapKey: mapId,
        spawnTileX:
          Number.isInteger(sourceEntry.spawnTileX) ? sourceEntry.spawnTileX : null,
        spawnTileY:
          Number.isInteger(sourceEntry.spawnTileY) ? sourceEntry.spawnTileY : null,
        entityId: getNextMonsterEntityId(),
        isMoving: false,
        nextRoamAt: 0,
        moveEndAt: 0,
        lastMoveSeq: 0,
      };

      list.push(newEntry);
      broadcast({
        t: "EvMobRespawn",
        mapId,
        monster: serializeMonsterEntries([newEntry])[0],
      });
    }, MOB_RESPAWN_DELAY_MS);

    monsterRespawnTimers.set(entityId, timer);
  }

  function handleCmdMobDeath(ws, clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (!mapId) return;
    const entityId = Number.isInteger(msg.entityId) ? msg.entityId : null;
    if (!entityId) return;
    const list = state.mapMonsters[mapId];
    if (!Array.isArray(list) || list.length === 0) return;

    const idx = list.findIndex((m) => m && m.entityId === entityId);
    if (idx < 0) return;
    const entry = list[idx];
    list.splice(idx, 1);

    const moveTimer = monsterMoveTimers.get(entityId);
    if (moveTimer) {
      clearTimeout(moveTimer);
      monsterMoveTimers.delete(entityId);
    }
    const respawnTimer = monsterRespawnTimers.get(entityId);
    if (respawnTimer) {
      clearTimeout(respawnTimer);
      monsterRespawnTimers.delete(entityId);
    }

    broadcast({ t: "EvMobDeath", mapId, entityId });
    scheduleMobRespawn(mapId, entry);

    Object.values(state.combats).forEach((combat) => {
      if (!combat || !Array.isArray(combat.mobEntityIds)) return;
      const idxCombat = combat.mobEntityIds.indexOf(entityId);
      if (idxCombat >= 0) {
        combat.mobEntityIds.splice(idxCombat, 1);
      }
    });
  }

  function handleCmdRequestMapMonsters(ws, clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (!mapId) return;
    const sendSnapshot = () => {
      const list = state.mapMonsters[mapId];
      if (!Array.isArray(list)) return false;
      send(ws, {
        t: "EvMapMonsters",
        eventId: getNextEventId(),
        mapId,
        monsters: serializeMonsterEntries(getVisibleMonstersForMap(mapId)),
      });
      return true;
    };
    if (sendSnapshot()) return;
    ensureMapInitialized(mapId);
    setTimeout(() => {
      sendSnapshot();
    }, 80);
  }

  function pickRandomNeighborTile(entry, width, height, occupiedKeys) {
    const candidates = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    for (let i = candidates.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = tmp;
    }

    for (const step of candidates) {
      const nx = entry.tileX + step.dx;
      const ny = entry.tileY + step.dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const key = `${nx},${ny}`;
      if (occupiedKeys.has(key)) continue;
      return { x: nx, y: ny };
    }

    return null;
  }

  function tickMobRoam() {
    const now = Date.now();
    const activeMaps = new Set();
    Object.values(state.players).forEach((player) => {
      if (player && typeof player.mapId === "string") {
        activeMaps.add(player.mapId);
      }
    });
    Object.entries(state.mapMonsters).forEach(([mapId, list]) => {
      if (!activeMaps.has(mapId)) return;
      if (!Array.isArray(list) || list.length === 0) return;
      const meta = state.mapMeta[mapId];
      if (!meta || !Number.isInteger(meta.width) || !Number.isInteger(meta.height)) {
        return;
      }
      const occupied = new Set();
      list.forEach((m) => {
        if (!m) return;
        if (Number.isInteger(m.tileX) && Number.isInteger(m.tileY)) {
          occupied.add(`${m.tileX},${m.tileY}`);
        }
      });

      list.forEach((entry) => {
        if (!entry || !Number.isInteger(entry.tileX) || !Number.isInteger(entry.tileY)) return;
        if (entry.inCombat) return;
        if (entry.isMoving && now < (entry.moveEndAt || 0)) return;
        if (entry.nextRoamAt && now < entry.nextRoamAt) return;

        entry.isMoving = false;

        const next = pickRandomNeighborTile(entry, meta.width, meta.height, occupied);
        const delayMs = Math.floor(8000 + Math.random() * 17000);
        entry.nextRoamAt = now + delayMs;
        if (!next) return;

        const seq = (entry.lastMoveSeq || 0) + 1;
        entry.lastMoveSeq = seq;

        occupied.delete(`${entry.tileX},${entry.tileY}`);
        occupied.add(`${next.x},${next.y}`);

        entry.tileX = next.x;
        entry.tileY = next.y;
        entry.isMoving = true;
        entry.moveEndAt = now + MONSTER_STEP_DURATION_MS;

        const prevTimer = monsterMoveTimers.get(entry.entityId);
        if (prevTimer) clearTimeout(prevTimer);
        const timer = setTimeout(() => {
          entry.isMoving = false;
          broadcast({
            t: "EvMobMoveEnd",
            entityId: entry.entityId,
            mapId,
            seq,
            toX: entry.tileX,
            toY: entry.tileY,
          });
        }, MONSTER_STEP_DURATION_MS);
        monsterMoveTimers.set(entry.entityId, timer);

        broadcast({
          t: "EvMobMoveStart",
          entityId: entry.entityId,
          mapId,
          seq,
          path: [{ x: next.x, y: next.y }],
          toX: entry.tileX,
          toY: entry.tileY,
        });
      });
    });
  }

  return {
    serializeMonsterEntries,
    handleCmdMapMonsters,
    handleCmdMobMoveStart,
    handleCmdMobDeath,
    handleCmdRequestMapMonsters,
    tickMobRoam,
  };
}

module.exports = {
  createMobHandlers,
};
