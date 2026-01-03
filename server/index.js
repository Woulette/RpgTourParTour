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
  state.players[playerId] = player;
  clients.set(ws, { id: playerId, lastCmdId: 0, ready: true });

  tryStartCombatIfNeeded();

  send(ws, {
    t: "EvWelcome",
    eventId: nextEventId++,
    playerId,
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

function handleCmdMove(clientInfo, msg) {
  if (clientInfo.id !== msg.playerId) return;
  if (!Number.isInteger(msg.toX) || !Number.isInteger(msg.toY)) return;

  const player = state.players[clientInfo.id];
  if (!player) return;

  const from = { x: player.x, y: player.y };
  player.x = msg.toX;
  player.y = msg.toY;

  broadcast({
    t: "EvMoved",
    playerId: player.id,
    fromX: from.x,
    fromY: from.y,
    toX: player.x,
    toY: player.y,
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
  });
});

// eslint-disable-next-line no-console
console.log(`[LAN] WebSocket server on ws://localhost:${PORT}`);
