const { WebSocketServer, WebSocket } = require("ws");
const {
  PROTOCOL_VERSION,
  DEFAULT_GAME_DATA_VERSION,
  MAX_PLAYERS,
} = require("./protocol");
const { createInitialState, createPlayer } = require("./state");

const PORT = Number(process.env.PORT || 8080);
const GAME_DATA_VERSION =
  process.env.GAME_DATA_VERSION || DEFAULT_GAME_DATA_VERSION;

const wss = new WebSocketServer({ port: PORT });
const state = createInitialState();
let nextPlayerId = 1;
let nextEventId = 1;
let nextMonsterEntityId = 1;
let nextResourceEntityId = 1;
let hostId = null;
const MONSTER_STEP_DURATION_MS = 550;
const monsterMoveTimers = new Map();
const MOB_ROAM_TICK_MS = 500;
const MOB_RESPAWN_DELAY_MS = 5000;
const monsterRespawnTimers = new Map();
const resourceRespawnTimers = new Map();

const clients = new Map(); // ws -> { id, lastCmdId, ready }

function send(ws, payload) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function broadcast(payload) {
  const event = { ...payload };
  if (!event.eventId) {
    event.eventId = nextEventId++;
  }
  for (const ws of clients.keys()) {
    send(ws, event);
  }
}

function snapshotForClient() {
  return {
    mapId: state.mapId,
    players: Object.values(state.players),
    combat: state.combat,
  };
}

function tryStartCombatIfNeeded() {
  const playerIds = Object.keys(state.players);
  if (playerIds.length === 0) return;
  if (!state.combat.activeId) {
    state.combat.activeId = Number(playerIds[0]);
    state.combat.turnIndex = 0;
  }
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

  if (clients.size >= MAX_PLAYERS) {
    send(ws, { t: "EvRefuse", reason: "room_full" });
    ws.close();
    return;
  }

  const playerId = nextPlayerId++;
  const player = createPlayer(playerId);
  player.mapId = state.mapId;
  state.players[playerId] = player;
  clients.set(ws, { id: playerId, lastCmdId: 0, ready: true });

  if (!hostId) {
    hostId = playerId;
  }

  tryStartCombatIfNeeded();

  send(ws, {
    t: "EvWelcome",
    eventId: nextEventId++,
    playerId,
    hostId,
    isHost: playerId === hostId,
    protocolVersion: PROTOCOL_VERSION,
    dataHash: GAME_DATA_VERSION,
    snapshot: snapshotForClient(),
  });

  broadcast({ t: "EvPlayerJoined", player });
}

function isCmdDuplicate(clientInfo, cmdId) {
  if (!Number.isInteger(cmdId)) return true;
  if (cmdId <= clientInfo.lastCmdId) return true;
  clientInfo.lastCmdId = cmdId;
  return false;
}

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

function sanitizeResourceEntries(raw) {
  if (!Array.isArray(raw)) return [];
  const result = [];
  const maxResources = 400;

  for (const entry of raw) {
    if (!entry) continue;
    const kind = typeof entry.kind === "string" ? entry.kind : null;
    if (!kind) continue;
    const tileX = Number.isInteger(entry.tileX) ? entry.tileX : null;
    const tileY = Number.isInteger(entry.tileY) ? entry.tileY : null;
    if (tileX === null || tileY === null) continue;

    const respawnMs =
      Number.isInteger(entry.respawnMs) && entry.respawnMs > 0
        ? entry.respawnMs
        : 30000;

    result.push({
      kind,
      tileX,
      tileY,
      offsetX: Number.isInteger(entry.offsetX) ? entry.offsetX : 0,
      offsetY: Number.isInteger(entry.offsetY) ? entry.offsetY : 0,
      resourceId: typeof entry.resourceId === "string" ? entry.resourceId : null,
      respawnMs,
      harvested: entry.harvested === true,
    });

    if (result.length >= maxResources) break;
  }

  return result;
}

function serializeResourceEntries(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && typeof entry.kind === "string")
    .map((entry) => ({
      entityId: Number.isInteger(entry.entityId) ? entry.entityId : null,
      kind: entry.kind,
      tileX: Number.isInteger(entry.tileX) ? entry.tileX : null,
      tileY: Number.isInteger(entry.tileY) ? entry.tileY : null,
      offsetX: Number.isInteger(entry.offsetX) ? entry.offsetX : 0,
      offsetY: Number.isInteger(entry.offsetY) ? entry.offsetY : 0,
      resourceId: typeof entry.resourceId === "string" ? entry.resourceId : null,
      respawnMs: Number.isInteger(entry.respawnMs) ? entry.respawnMs : 30000,
      harvested: entry.harvested === true,
    }));
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
  if (clientInfo.id !== msg.playerId) return;
  if (clientInfo.id !== hostId) return;
  const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
  if (!mapId) return;

  if (
    Number.isInteger(msg.mapWidth) &&
    Number.isInteger(msg.mapHeight) &&
    msg.mapWidth > 0 &&
    msg.mapHeight > 0
  ) {
    state.mapMeta[mapId] = { width: msg.mapWidth, height: msg.mapHeight };
  }

  if (!state.mapMonsters[mapId]) {
    const entries = sanitizeMonsterEntries(msg.monsters);
    entries.forEach((entry) => {
      entry.entityId = nextMonsterEntityId++;
      entry.spawnMapKey = mapId;
      entry.spawnTileX = entry.tileX;
      entry.spawnTileY = entry.tileY;
      entry.isMoving = false;
      entry.nextRoamAt = 0;
      entry.moveEndAt = 0;
    });
    state.mapMonsters[mapId] = entries;
    broadcast({ t: "EvMapMonsters", mapId, monsters: serializeMonsterEntries(entries) });
    return;
  }

  send(ws, {
    t: "EvMapMonsters",
    eventId: nextEventId++,
    mapId,
    monsters: serializeMonsterEntries(state.mapMonsters[mapId]),
  });
}

function handleCmdMapResources(ws, clientInfo, msg) {
  if (clientInfo.id !== msg.playerId) return;
  if (clientInfo.id !== hostId) return;
  const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
  if (!mapId) return;

  if (!state.mapResources[mapId]) {
    const entries = sanitizeResourceEntries(msg.resources);
    entries.forEach((entry) => {
      entry.entityId = nextResourceEntityId++;
      entry.spawnMapKey = mapId;
    });
    state.mapResources[mapId] = entries;
    broadcast({ t: "EvMapResources", mapId, resources: serializeResourceEntries(entries) });
    return;
  }

  send(ws, {
    t: "EvMapResources",
    eventId: nextEventId++,
    mapId,
    resources: serializeResourceEntries(state.mapResources[mapId]),
  });
}

function handleCmdMobMoveStart(ws, clientInfo, msg) {
  if (clientInfo.id !== msg.playerId) return;
  if (clientInfo.id !== hostId) return;
  const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
  if (!mapId) return;
  const entityId = Number.isInteger(msg.entityId) ? msg.entityId : null;
  if (!entityId) return;

  const list = state.mapMonsters[mapId];
  if (!Array.isArray(list) || list.length === 0) return;
  const entry = list.find((m) => m && m.entityId === entityId);
  if (!entry) return;

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
    const playersOnMap = Object.values(state.players).some(
      (player) => player && player.mapId === mapId
    );
    if (!playersOnMap) {
      scheduleMobRespawn(mapId, sourceEntry);
      return;
    }

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
      entityId: nextMonsterEntityId++,
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
}

function scheduleResourceRespawn(mapId, entry) {
  if (!mapId || !entry) return;
  const entityId = entry.entityId;
  if (resourceRespawnTimers.has(entityId)) {
    clearTimeout(resourceRespawnTimers.get(entityId));
    resourceRespawnTimers.delete(entityId);
  }
  const delayMs = Number.isInteger(entry.respawnMs) ? entry.respawnMs : 30000;

  const timer = setTimeout(() => {
    const playersOnMap = Object.values(state.players).some(
      (player) => player && player.mapId === mapId
    );
    if (!playersOnMap) {
      scheduleResourceRespawn(mapId, entry);
      return;
    }

    const list = state.mapResources[mapId];
    if (!Array.isArray(list)) return;
    const target = list.find((r) => r && r.entityId === entityId);
    if (!target) return;

    target.harvested = false;
    broadcast({
      t: "EvResourceRespawned",
      mapId,
      entityId,
      kind: target.kind,
    });
  }, delayMs);

  resourceRespawnTimers.set(entityId, timer);
}

function handleCmdResourceHarvest(ws, clientInfo, msg) {
  if (clientInfo.id !== msg.playerId) return;
  const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
  if (!mapId) return;
  const entityId = Number.isInteger(msg.entityId) ? msg.entityId : null;
  if (!entityId) return;
  const list = state.mapResources[mapId];
  if (!Array.isArray(list) || list.length === 0) return;

  const entry = list.find((r) => r && r.entityId === entityId);
  if (!entry) return;
  if (entry.harvested) return;

  entry.harvested = true;
  broadcast({
    t: "EvResourceHarvested",
    mapId,
    entityId,
    kind: entry.kind,
    harvesterId: clientInfo.id,
  });
  scheduleResourceRespawn(mapId, entry);
}

function handleCmdRequestMapMonsters(ws, clientInfo, msg) {
  if (clientInfo.id !== msg.playerId) return;
  const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
  if (!mapId) return;
  const list = state.mapMonsters[mapId];
  if (!Array.isArray(list) || list.length === 0) return;
  send(ws, {
    t: "EvMapMonsters",
    eventId: nextEventId++,
    mapId,
    monsters: serializeMonsterEntries(list),
  });
}

function handleCmdRequestMapResources(ws, clientInfo, msg) {
  if (clientInfo.id !== msg.playerId) return;
  const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
  if (!mapId) return;
  const list = state.mapResources[mapId];
  if (!Array.isArray(list) || list.length === 0) return;
  send(ws, {
    t: "EvMapResources",
    eventId: nextEventId++,
    mapId,
    resources: serializeResourceEntries(list),
  });
}

function handleCmdMove(clientInfo, msg) {
  if (clientInfo.id !== msg.playerId) return;
  if (!Number.isInteger(msg.toX) || !Number.isInteger(msg.toY)) return;

  const player = state.players[clientInfo.id];
  if (!player) return;
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

function handleCmdCastSpell(clientInfo, msg) {
  if (clientInfo.id !== msg.playerId) return;
  if (!msg.spellId) return;

  broadcast({
    t: "EvSpellCast",
    casterId: clientInfo.id,
    spellId: msg.spellId,
    targetX: msg.targetX ?? null,
    targetY: msg.targetY ?? null,
    targetId: msg.targetId ?? null,
  });
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg = null;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    const clientInfo = clients.get(ws);
    if (!clientInfo) {
      if (msg?.t === "Hello") handleHello(ws, msg);
      return;
    }

    if (msg?.t?.startsWith("Cmd")) {
      if (isCmdDuplicate(clientInfo, msg.cmdId)) return;
    }

    switch (msg.t) {
      case "CmdMove":
        handleCmdMove(clientInfo, msg);
        break;
      case "CmdMapMonsters":
        handleCmdMapMonsters(ws, clientInfo, msg);
        break;
      case "CmdMapResources":
        handleCmdMapResources(ws, clientInfo, msg);
        break;
      case "CmdMobMoveStart":
        handleCmdMobMoveStart(ws, clientInfo, msg);
        break;
      case "CmdMobDeath":
        handleCmdMobDeath(ws, clientInfo, msg);
        break;
      case "CmdRequestMapMonsters":
        handleCmdRequestMapMonsters(ws, clientInfo, msg);
        break;
      case "CmdRequestMapResources":
        handleCmdRequestMapResources(ws, clientInfo, msg);
        break;
      case "CmdResourceHarvest":
        handleCmdResourceHarvest(ws, clientInfo, msg);
        break;
      case "CmdMapChange":
        handleCmdMapChange(clientInfo, msg);
        break;
      case "CmdEndTurn":
        handleCmdEndTurn(clientInfo, msg);
        break;
      case "CmdCastSpell":
        handleCmdCastSpell(clientInfo, msg);
        break;
      default:
        break;
    }
  });

  ws.on("close", () => {
    const clientInfo = clients.get(ws);
    if (!clientInfo) return;
    delete state.players[clientInfo.id];
    clients.delete(ws);
    broadcast({ t: "EvPlayerLeft", playerId: clientInfo.id });
    if (clientInfo.id === hostId) {
      const next = clients.values().next().value || null;
      hostId = next ? next.id : null;
      if (hostId) {
        broadcast({ t: "EvHostChanged", hostId });
      }
    }
  });
});

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

setInterval(tickMobRoam, MOB_ROAM_TICK_MS);

// eslint-disable-next-line no-console
console.log(`[LAN] WebSocket server on ws://localhost:${PORT}`);
