const { WebSocketServer, WebSocket } = require("ws");
const path = require("path");
const { pathToFileURL } = require("url");
const {
  PROTOCOL_VERSION,
  DEFAULT_GAME_DATA_VERSION,
  MAX_PLAYERS,
} = require("./protocol");
const { createInitialState, createPlayer } = require("./state");
const { createCombatHandlers } = require("./handlers/combat");
const { createMobHandlers } = require("./handlers/mobs");
const { createResourceHandlers } = require("./handlers/resources");
const { createPlayerHandlers } = require("./handlers/players");
const { createCharacterStore } = require("./db/characters");
const { buildMonsterStats } = require("./handlers/combat/monsterStats");

const PORT = Number(process.env.PORT || 8080);
const GAME_DATA_VERSION =
  process.env.GAME_DATA_VERSION || DEFAULT_GAME_DATA_VERSION;

const wss = new WebSocketServer({ port: PORT });
const state = createInitialState();
let nextPlayerId = 1;
let nextEventId = 1;
let nextMonsterEntityId = 1;
let nextResourceEntityId = 1;
let nextCombatId = 1;
let hostId = null;
const MONSTER_STEP_DURATION_MS = 550;
const monsterMoveTimers = new Map();
const MOB_ROAM_TICK_MS = 500;
const MOB_RESPAWN_DELAY_MS = 5000;
const monsterRespawnTimers = new Map();
const resourceRespawnTimers = new Map();
const mapInitRequests = new Map();
const DEBUG_COMBAT = process.env.LAN_COMBAT_DEBUG === "1";
const characterStore = createCharacterStore({ dataDir: path.resolve(__dirname, "data") });

let statsApi = null;
let statsApiFailed = false;
const statsApiPromise = import(
  pathToFileURL(path.resolve(__dirname, "../src/core/stats.js")).href
)
  .then((mod) => {
    statsApi = mod || null;
  })
  .catch((err) => {
    statsApiFailed = true;
    // eslint-disable-next-line no-console
    console.warn("[LAN] Failed to load stats module:", err?.message || err);
  });

let classDefs = null;
let classDefsFailed = false;
const classDefsPromise = import(
  pathToFileURL(path.resolve(__dirname, "../src/config/classes.js")).href
)
  .then((mod) => {
    classDefs = mod?.classes || null;
  })
  .catch((err) => {
    classDefsFailed = true;
    // eslint-disable-next-line no-console
    console.warn("[LAN] Failed to load classes config:", err?.message || err);
  });
const debugCombatLog = (...args) => {
  if (!DEBUG_COMBAT) return;
  // eslint-disable-next-line no-console
  console.log("[LAN][Combat]", ...args);
};

const clients = new Map(); // ws -> { id, lastCmdId, ready }
const eventHistory = [];
const MAX_EVENT_HISTORY = 0;
const combatEventHistory = new Map(); // combatId -> events
const MAX_COMBAT_EVENT_HISTORY = 200;
const COMBAT_EVENT_TYPES = new Set([
  "EvCombatCreated",
  "EvCombatUpdated",
  "EvCombatJoinReady",
  "EvCombatState",
  "EvCombatMoveStart",
  "EvCombatMonsterMoveStart",
  "EvCombatTurnStarted",
  "EvCombatTurnEnded",
  "EvCombatEnded",
  "EvSpellCast",
  "EvDamageApplied",
]);

  let spellDefs = null;
  let spellDefsFailed = false;
  let monsterSpellDefs = null;
  let monsterSpellDefsFailed = false;
  const spellDefsPromise = import(
    pathToFileURL(path.resolve(__dirname, "../src/config/spells.js")).href
  )
  .then((mod) => {
    spellDefs = mod?.spells || null;
  })
    .catch((err) => {
      spellDefsFailed = true;
      // eslint-disable-next-line no-console
      console.warn("[LAN] Failed to load spells config:", err?.message || err);
    });

  const monsterSpellDefsPromise = import(
    pathToFileURL(path.resolve(__dirname, "../src/content/spells/monsters/index.js")).href
  )
    .then((mod) => {
      monsterSpellDefs = mod?.monsterSpells || null;
    })
    .catch((err) => {
      monsterSpellDefsFailed = true;
      // eslint-disable-next-line no-console
      console.warn("[LAN] Failed to load monster spells:", err?.message || err);
    });

  let monsterDefs = null;
  let monsterDefsFailed = false;
  const monsterDefsPromise = import(
    pathToFileURL(path.resolve(__dirname, "../src/content/monsters/index.js")).href
  )
    .then((mod) => {
      monsterDefs = mod?.monsters || null;
    })
    .catch((err) => {
      monsterDefsFailed = true;
      // eslint-disable-next-line no-console
      console.warn("[LAN] Failed to load monsters config:", err?.message || err);
    });

  let combatPatterns = null;
  let combatPatternsFailed = false;
  const combatPatternsPromise = import(
    pathToFileURL(path.resolve(__dirname, "../src/combatPatterns.js")).href
  )
    .then((mod) => {
      combatPatterns = mod?.COMBAT_PATTERNS || null;
    })
    .catch((err) => {
      combatPatternsFailed = true;
      // eslint-disable-next-line no-console
      console.warn("[LAN] Failed to load combat patterns:", err?.message || err);
    });

let combatStartPositions = null;
let combatStartPositionsFailed = false;
const combatStartPositionsPromise = import(
  pathToFileURL(path.resolve(__dirname, "../src/config/combatStartPositions.js")).href
)
    .then((mod) => {
      combatStartPositions = mod?.COMBAT_START_POSITIONS || null;
    })
    .catch((err) => {
      combatStartPositionsFailed = true;
      // eslint-disable-next-line no-console
    console.warn("[LAN] Failed to load combat start positions:", err?.message || err);
  });

let captureRules = null;
let captureRulesFailed = false;
const captureRulesPromise = import(
  pathToFileURL(path.resolve(__dirname, "../src/config/captureRules.js")).href
)
  .then((mod) => {
    captureRules = mod || null;
  })
  .catch((err) => {
    captureRulesFailed = true;
    // eslint-disable-next-line no-console
    console.warn("[LAN] Failed to load capture rules:", err?.message || err);
  });

function send(ws, payload) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

  function getSpellDef(spellId) {
    if (!spellId) return null;
    const base = spellDefs && spellDefs[spellId] ? spellDefs[spellId] : null;
    if (base) return base;
    if (!monsterSpellDefs) return null;
    for (const list of Object.values(monsterSpellDefs)) {
      if (!list) continue;
      const entry = list[spellId];
      if (entry) return entry;
    }
    return null;
  }

  function getMonsterDef(monsterId) {
    if (!monsterId || !monsterDefs) return null;
    return monsterDefs[monsterId] || null;
  }

  function isMonsterCapturable(monsterId) {
    if (!monsterId || !captureRules || captureRulesFailed) return true;
    const fn = captureRules.isMonsterCapturable;
    if (typeof fn !== "function") return true;
    return fn(monsterId);
  }

  function getCombatPattern(patternId) {
    if (!combatPatterns) return null;
    return combatPatterns[patternId] || null;
  }

function getCombatStartPositions(mapId) {
  if (!combatStartPositions || !mapId) return null;
  return combatStartPositions[mapId] || null;
}

function buildBaseStatsForClass(classId) {
  if (!statsApi || !classDefs) return null;
  const {
    createStats,
    applyBonuses,
    applyDerivedAgilityStats,
  } = statsApi;
  if (!createStats || !applyBonuses || !applyDerivedAgilityStats) return null;
  const def = classDefs[classId] || classDefs.archer || null;
  const base = createStats();
  const withBonuses = applyBonuses(base, def?.statBonuses || []);
  const derived = applyDerivedAgilityStats({ ...withBonuses });
  const initBonus = derived.initiative ?? 0;
  derived.initiative = initBonus;
  return derived;
}

function computeFinalStats(baseStats) {
  if (!statsApi || !baseStats) return null;
  const { applyDerivedAgilityStats } = statsApi;
  if (!applyDerivedAgilityStats) return null;
  const derived = applyDerivedAgilityStats({ ...baseStats });
  const initBonus = derived.initiative ?? 0;
  const derivedInit =
    (derived.force ?? 0) +
    (derived.intelligence ?? 0) +
    (derived.agilite ?? 0) +
    (derived.chance ?? 0);
  derived.initiative = initBonus + derivedInit;
  const baseHpMax = derived.hpMax ?? baseStats.hpMax ?? 50;
  const vit = derived.vitalite ?? 0;
  derived.hpMax = baseHpMax + vit;
  if (!Number.isFinite(derived.hp)) {
    derived.hp = derived.hpMax;
  }
  derived.hp = Math.min(derived.hp, derived.hpMax);
  return derived;
}

function getMonsterCombatStats(def, level) {
  if (!def || !statsApi) return null;
  return buildMonsterStats(def, level, statsApi);
}

function isSimpleDamageSpell(spell) {
  if (!spell) return false;
  const effects = Array.isArray(spell.effects) ? spell.effects : null;
  if (!effects || effects.length !== 1) return false;
  if (effects[0]?.type !== "damage") return false;
  if (spell.effectPattern || spell.areaBuff || spell.summon) return false;
  if (spell.capture || spell.summonMonster || spell.summonCaptured) return false;
  return true;
}

function rollSpellDamage(spell) {
  const min = Number.isFinite(spell.damageMin) ? spell.damageMin : 0;
  const max = Number.isFinite(spell.damageMax) ? spell.damageMax : min;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function broadcast(payload) {
  const event = { ...payload };
  if (!event.eventId) {
    event.eventId = nextEventId++;
  }
  if (
    COMBAT_EVENT_TYPES.has(event.t) &&
    Number.isInteger(event.combatId) &&
    !Number.isInteger(event.combatSeq)
  ) {
    const combat = state.combats[event.combatId];
    if (combat) {
      combat.combatSeq = Number.isInteger(combat.combatSeq) ? combat.combatSeq + 1 : 1;
      event.combatSeq = combat.combatSeq;
    }
  }
  if (!COMBAT_EVENT_TYPES.has(event.t) && MAX_EVENT_HISTORY > 0) {
    eventHistory.push(event);
    if (eventHistory.length > MAX_EVENT_HISTORY) {
      eventHistory.shift();
    }
  }
  if (COMBAT_EVENT_TYPES.has(event.t) && Number.isInteger(event.combatId)) {
    const list = combatEventHistory.get(event.combatId) || [];
    list.push(event);
    if (list.length > MAX_COMBAT_EVENT_HISTORY) {
      list.shift();
    }
    combatEventHistory.set(event.combatId, list);
  }
  if (event.t === "EvCombatEnded" && Number.isInteger(event.combatId)) {
    combatEventHistory.delete(event.combatId);
  }
  if (DEBUG_COMBAT && (event.t === "EvDamageApplied" || event.t === "EvSpellCast")) {
    // eslint-disable-next-line no-console
    console.log("[LAN][Combat]", "broadcast", {
      t: event.t,
      eventId: event.eventId,
      combatId: event.combatId ?? null,
      casterId: event.casterId ?? null,
      spellId: event.spellId ?? null,
      targetX: event.targetX ?? null,
      targetY: event.targetY ?? null,
      targetKind: event.targetKind ?? null,
      targetId: event.targetId ?? null,
      targetIndex: event.targetIndex ?? null,
      damage: event.damage ?? null,
      source: event.source ?? null,
      authoritative: event.authoritative ?? null,
    });
  }
  for (const ws of clients.keys()) {
    send(ws, event);
  }
}

function getHostSocket() {
  if (!hostId) return null;
  for (const [ws, info] of clients.entries()) {
    if (info && info.id === hostId) return ws;
  }
  return null;
}

  function findClientOnMap(mapId) {
    for (const [ws, info] of clients.entries()) {
      if (!info || !Number.isInteger(info.id)) continue;
      const player = state.players[info.id];
      if (player && player.mapId === mapId) return ws;
    }
    return null;
  }

  function ensureMapInitialized(mapId) {
    if (!mapId) return false;
    if (state.mapMonsters[mapId] && state.mapResources[mapId]) return true;
    const targetSocket = findClientOnMap(mapId) || getHostSocket();
    if (!targetSocket) return false;
    const now = Date.now();
    const last = mapInitRequests.get(mapId) || 0;
    if (now - last < 1500) return false;
    mapInitRequests.set(mapId, now);
    send(targetSocket, { t: "EvEnsureMapInit", mapId });
    return false;
  }

function snapshotForClient() {
  return {
    mapId: state.mapId,
    players: Object.values(state.players),
    combat: state.combat,
    combats: combatHandlers.listActiveCombats(),
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

function isCmdDuplicate(clientInfo, cmdId) {
  if (!Number.isInteger(cmdId)) return true;
  if (cmdId <= clientInfo.lastCmdId) return true;
  clientInfo.lastCmdId = cmdId;
  return false;
}

const RATE_LIMITS = {
  CmdMove: { limit: 12, windowMs: 1000 },
  CmdMoveCombat: { limit: 6, windowMs: 1000 },
  CmdCastSpell: { limit: 4, windowMs: 1000 },
  CmdEndTurnCombat: { limit: 1, windowMs: 1000 },
  CmdCombatStart: { limit: 2, windowMs: 2000 },
  CmdJoinCombat: { limit: 2, windowMs: 2000 },
  CmdCombatReady: { limit: 2, windowMs: 2000 },
  CmdCombatPlacement: { limit: 6, windowMs: 1000 },
  CmdMapChange: { limit: 4, windowMs: 1000 },
  CmdMapMonsters: { limit: 2, windowMs: 2000 },
  CmdMapResources: { limit: 2, windowMs: 2000 },
  CmdRequestMapMonsters: { limit: 4, windowMs: 2000 },
  CmdRequestMapResources: { limit: 4, windowMs: 2000 },
  CmdResourceHarvest: { limit: 4, windowMs: 1000 },
};

function isCmdRateLimited(clientInfo, cmdType) {
  const rule = RATE_LIMITS[cmdType];
  if (!rule) return false;
  const now = Date.now();
  if (!clientInfo.rateLimits) clientInfo.rateLimits = {};
  const entry = clientInfo.rateLimits[cmdType] || { count: 0, windowStart: now };
  if (now - entry.windowStart >= rule.windowMs) {
    entry.count = 0;
    entry.windowStart = now;
  }
  if (entry.count >= rule.limit) {
    clientInfo.rateLimits[cmdType] = entry;
    return true;
  }
  entry.count += 1;
  clientInfo.rateLimits[cmdType] = entry;
  return false;
}

function sanitizePlayerPath(raw, maxSteps = 32) {
  if (!Array.isArray(raw)) return [];
  const steps = [];
  for (const step of raw) {
    if (steps.length >= maxSteps) break;
    const x = Number.isInteger(step?.x) ? step.x : null;
    const y = Number.isInteger(step?.y) ? step.y : null;
    if (x === null || y === null) break;
    steps.push({ x, y });
  }
  return steps;
}

const getNextEventId = () => nextEventId++;
const getNextPlayerId = () => nextPlayerId++;
const getNextMonsterEntityId = () => nextMonsterEntityId++;
const getNextResourceEntityId = () => nextResourceEntityId++;
const getNextCombatId = () => nextCombatId++;
let nextSummonId = 1;
const getNextSummonId = () => nextSummonId++;
const getHostId = () => hostId;
const setHostId = (id) => {
  hostId = id;
};

const mobHandlers = createMobHandlers({
  state,
  broadcast,
  send,
  getNextEventId,
  getNextMonsterEntityId,
  getHostId,
  ensureMapInitialized,
  monsterMoveTimers,
  monsterRespawnTimers,
  config: { MONSTER_STEP_DURATION_MS, MOB_RESPAWN_DELAY_MS },
});

const resourceHandlers = createResourceHandlers({
  state,
  broadcast,
  send,
  getNextEventId,
  getNextResourceEntityId,
  getHostId,
  ensureMapInitialized,
  resourceRespawnTimers,
});

  const combatHandlers = createCombatHandlers({
    state,
    broadcast,
    send,
    getNextCombatId,
    getNextEventId,
    getNextSummonId,
    getHostId,
    sanitizePlayerPath,
    serializeMonsterEntries: mobHandlers.serializeMonsterEntries,
    monsterMoveTimers,
    getSpellDef,
    isSimpleDamageSpell,
    rollSpellDamage,
    getMonsterDef,
    getMonsterCombatStats,
    isMonsterCapturable,
    getCombatPattern,
    getCombatStartPositions,
  });

const playerHandlers = createPlayerHandlers({
  state,
  clients,
  broadcast,
  send,
  createPlayer,
  config: {
    PROTOCOL_VERSION,
    GAME_DATA_VERSION,
    MAX_PLAYERS,
  },
  getNextPlayerId,
  getNextEventId,
  getHostId,
  setHostId,
  tryStartCombatIfNeeded,
  snapshotForClient,
  ensureMapInitialized,
  characterStore,
  buildBaseStatsForClass,
  computeFinalStats,
});

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
      if (msg?.t === "Hello") playerHandlers.handleHello(ws, msg);
      return;
    }

    if (msg?.t?.startsWith("Cmd")) {
      if (isCmdDuplicate(clientInfo, msg.cmdId)) {
        debugCombatLog("Cmd drop: duplicate", {
          t: msg.t,
          cmdId: msg.cmdId,
          playerId: clientInfo.id,
        });
        return;
      }
      if (isCmdRateLimited(clientInfo, msg.t)) {
        debugCombatLog("Cmd drop: rate limited", {
          t: msg.t,
          cmdId: msg.cmdId ?? null,
          playerId: clientInfo.id,
        });
        return;
      }
    }

    switch (msg.t) {
      case "CmdAck": {
        const lastEventId = Number.isInteger(msg.lastEventId) ? msg.lastEventId : null;
        if (lastEventId !== null) {
          clientInfo.lastAckEventId = Math.max(
            clientInfo.lastAckEventId || 0,
            lastEventId
          );
        }
        break;
      }
      case "CmdEventReplay":
        break;
      case "CmdCombatReplay": {
        const combatId = Number.isInteger(msg.combatId) ? msg.combatId : null;
        const fromSeq = Number.isInteger(msg.fromSeq) ? msg.fromSeq : null;
        if (combatId !== null && fromSeq !== null) {
          const list = combatEventHistory.get(combatId) || [];
          list.filter((ev) => ev && ev.combatSeq >= fromSeq).forEach((ev) => send(ws, ev));
        }
        break;
      }
      case "CmdMove":
        playerHandlers.handleCmdMove(clientInfo, msg);
        break;
      case "CmdMoveCombat":
        combatHandlers.handleCmdMoveCombat(clientInfo, msg);
        break;
      case "CmdCombatPlacement":
        combatHandlers.handleCmdCombatPlacement(clientInfo, msg);
        break;
      case "CmdMapMonsters":
        mobHandlers.handleCmdMapMonsters(ws, clientInfo, msg);
        break;
      case "CmdMapResources":
        resourceHandlers.handleCmdMapResources(ws, clientInfo, msg);
        break;
      case "CmdMobMoveStart":
        mobHandlers.handleCmdMobMoveStart(ws, clientInfo, msg);
        break;
      case "CmdMobDeath":
        mobHandlers.handleCmdMobDeath(ws, clientInfo, msg);
        break;
      case "CmdRequestMapMonsters":
        mobHandlers.handleCmdRequestMapMonsters(ws, clientInfo, msg);
        break;
      case "CmdRequestMapResources":
        resourceHandlers.handleCmdRequestMapResources(ws, clientInfo, msg);
        break;
      case "CmdResourceHarvest":
        resourceHandlers.handleCmdResourceHarvest(ws, clientInfo, msg);
        break;
      case "CmdMapChange":
        playerHandlers.handleCmdMapChange(clientInfo, msg);
        break;
      case "CmdCombatStart":
        combatHandlers.handleCmdCombatStart(ws, clientInfo, msg);
        break;
      case "CmdJoinCombat":
        combatHandlers.handleCmdJoinCombat(ws, clientInfo, msg);
        break;
      case "CmdCombatReady":
        combatHandlers.handleCmdCombatReady(clientInfo, msg);
        break;
      case "CmdCombatEnd":
        combatHandlers.handleCmdCombatEnd(ws, clientInfo, msg);
        break;
      case "CmdCombatDamageApplied":
        debugCombatLog("CmdCombatDamageApplied recv", {
          cmdId: msg.cmdId ?? null,
          playerId: clientInfo.id,
          combatId: msg.combatId ?? null,
          source: msg.source ?? null,
          damage: msg.damage ?? null,
          targetX: msg.targetX ?? null,
          targetY: msg.targetY ?? null,
          targetKind: msg.targetKind ?? null,
          targetId: msg.targetId ?? null,
          targetIndex: msg.targetIndex ?? null,
          clientSeq: msg.clientSeq ?? null,
        });
        combatHandlers.handleCmdCombatDamageApplied(clientInfo, msg);
        break;
      case "CmdCombatState":
        combatHandlers.handleCmdCombatState(clientInfo, msg);
        break;
      case "CmdEndTurnCombat":
        combatHandlers.handleCmdEndTurnCombat(clientInfo, msg);
        break;
      case "CmdCombatMonsterMoveStart":
        combatHandlers.handleCmdCombatMonsterMoveStart(clientInfo, msg);
        break;
      case "CmdCombatChecksum":
        combatHandlers.handleCmdCombatChecksum(ws, clientInfo, msg);
        break;
      case "CmdEndTurn":
        playerHandlers.handleCmdEndTurn(clientInfo, msg);
        break;
      case "CmdCastSpell":
        debugCombatLog("CmdCastSpell recv", {
          cmdId: msg.cmdId ?? null,
          playerId: clientInfo.id,
          combatId: msg.combatId ?? null,
          spellId: msg.spellId ?? null,
          targetX: msg.targetX ?? null,
          targetY: msg.targetY ?? null,
          targetKind: msg.targetKind ?? null,
          targetId: msg.targetId ?? null,
          targetIndex: msg.targetIndex ?? null,
        });
        combatHandlers.handleCmdCastSpell(clientInfo, msg);
        break;
      default:
        break;
    }
  });

  ws.on("close", () => {
    const clientInfo = clients.get(ws);
    if (!clientInfo) return;
    const player = state.players[clientInfo.id];
    const combatId = player && Number.isInteger(player.combatId) ? player.combatId : null;
    if (combatId) {
      combatHandlers.finalizeCombat(combatId);
    }
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

setInterval(() => mobHandlers.tickMobRoam(), MOB_ROAM_TICK_MS);

// eslint-disable-next-line no-console
console.log(`[LAN] WebSocket server on ws://localhost:${PORT}`);
