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

const clients = new Map(); // ws -> { id, lastCmdId, ready }

let spellDefs = null;
let spellDefsFailed = false;
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

function send(ws, payload) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function getSpellDef(spellId) {
  if (!spellId || !spellDefs) return null;
  return spellDefs[spellId] || null;
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

function ensureMapInitialized(mapId) {
  if (!mapId) return false;
  if (state.mapMonsters[mapId] && state.mapResources[mapId]) return true;
  const hostSocket = getHostSocket();
  if (!hostSocket) return false;
  const now = Date.now();
  const last = mapInitRequests.get(mapId) || 0;
  if (now - last < 1500) return false;
  mapInitRequests.set(mapId, now);
  send(hostSocket, { t: "EvEnsureMapInit", mapId });
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
  getHostId,
  sanitizePlayerPath,
  serializeMonsterEntries: mobHandlers.serializeMonsterEntries,
  monsterMoveTimers,
  getSpellDef,
  isSimpleDamageSpell,
  rollSpellDamage,
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
      if (isCmdDuplicate(clientInfo, msg.cmdId)) return;
    }

    switch (msg.t) {
      case "CmdMove":
        playerHandlers.handleCmdMove(clientInfo, msg);
        break;
      case "CmdMoveCombat":
        combatHandlers.handleCmdMoveCombat(clientInfo, msg);
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
      case "CmdEndTurn":
        playerHandlers.handleCmdEndTurn(clientInfo, msg);
        break;
      case "CmdCastSpell":
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
