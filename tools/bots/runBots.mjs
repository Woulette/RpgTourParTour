import { PROTOCOL_VERSION, DATA_HASH } from "../../src/net/protocol.js";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const argv = process.argv.slice(2);

function getArgValue(flag, fallback) {
  const match = argv.find((entry) => entry.startsWith(`${flag}=`));
  if (!match) return fallback;
  return match.slice(flag.length + 1);
}

const count = Math.max(1, Number(getArgValue("--count", "20")) || 20);
const url = getArgValue("--url", process.env.BOT_URL || "ws://localhost:8080");
const prefix = getArgValue("--prefix", "bot");
const authMode = getArgValue("--auth", "auto");
const targetMapId = getArgValue("--map", null);
const spawnX = Number.isInteger(Number(getArgValue("--spawnX", "")))
  ? Number(getArgValue("--spawnX", ""))
  : null;
const spawnY = Number.isInteger(Number(getArgValue("--spawnY", "")))
  ? Number(getArgValue("--spawnY", ""))
  : null;

function resolveWebSocket() {
  if (globalThis.WebSocket) return globalThis.WebSocket;
  try {
    const serverRequire = createRequire(new URL("../../server/index.js", import.meta.url));
    const wsPkg = serverRequire("ws");
    return wsPkg.WebSocket || wsPkg;
  } catch {
    return null;
  }
}

const WebSocketImpl = resolveWebSocket();
if (!WebSocketImpl) {
  throw new Error("WebSocket not available. Install deps in server/ or use Node 20+ with WebSocket.");
}

function randomDelay(base, spread) {
  return base + Math.floor(Math.random() * spread);
}

class BotClient {
  constructor(index) {
    this.index = index;
    this.nameSuffix = Math.random().toString(16).slice(2, 6);
    this.accountName = `${prefix}_${index}_${this.nameSuffix}`;
    this.password = "botpass";
    this.characterId = randomUUID();
    this.characterName = `Bot ${index}-${this.nameSuffix}`;
    this.classId = "archer";
    this.level = 1;
    this.cmdId = 0;
    this.playerId = null;
    this.sessionToken = null;
    this.mapId = null;
    this.x = 0;
    this.y = 0;
    this.resources = [];
    this.monsters = [];
    this.inCombat = false;
    this.combatId = null;
    this.timers = [];
    this.ws = null;
  }

  start() {
    this.ws = new WebSocketImpl(url);
    this.ws.addEventListener("open", () => {
      console.log(`[bot ${this.index}] ws open`);
      this.sendHello();
    });
    this.ws.addEventListener("message", (event) => this.onMessage(event));
    this.ws.addEventListener("close", (event) => {
      console.log(`[bot ${this.index}] ws close`, {
        code: event?.code,
        reason: event?.reason,
      });
      this.cleanup();
    });
    this.ws.addEventListener("error", (event) => {
      console.log(`[bot ${this.index}] ws error`, event?.message || event);
      this.cleanup();
    });
  }

  sendHello() {
    const payload = {
      t: "Hello",
      protocolVersion: PROTOCOL_VERSION,
      dataHash: DATA_HASH,
      sessionToken: null,
      accountName: this.accountName,
      accountPassword: this.password,
      authMode,
      inventoryAuthority: true,
      characterId: this.characterId,
      characterName: this.characterName,
      classId: this.classId,
      level: this.level,
    };
    this.ws.send(JSON.stringify(payload));
  }

  sendCmd(type, payload = {}) {
    if (!this.ws || this.ws.readyState !== WebSocketImpl.OPEN) return;
    this.cmdId += 1;
    this.ws.send(
      JSON.stringify({
        t: type,
        cmdId: this.cmdId,
        sessionToken: this.sessionToken || null,
        ...payload,
      })
    );
  }

  onMessage(event) {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (msg?.t === "EvRefuse") {
      console.log(`[bot ${this.index}] refused`, msg);
      this.ws.close();
      return;
    }

    if (msg?.t === "EvWelcome") {
      console.log(`[bot ${this.index}] welcome`, {
        playerId: msg.playerId,
        mapId: msg.snapshot?.mapId,
      });
      this.playerId = msg.playerId ?? null;
      this.sessionToken = msg.sessionToken || null;
      this.mapId = msg.snapshot?.mapId || null;
      const players = Array.isArray(msg.snapshot?.players)
        ? msg.snapshot.players
        : [];
      const self = players.find((p) => p && p.id === this.playerId) || null;
      if (self) {
        this.mapId = self.mapId || this.mapId;
        this.x = Number.isFinite(self.x) ? self.x : this.x;
        this.y = Number.isFinite(self.y) ? self.y : this.y;
      }
      if (targetMapId && targetMapId !== this.mapId) {
        this.sendCmd("CmdMapChange", {
          playerId: this.playerId,
          mapId: targetMapId,
          tileX: spawnX,
          tileY: spawnY,
        });
        if (Number.isFinite(spawnX)) this.x = spawnX;
        if (Number.isFinite(spawnY)) this.y = spawnY;
      } else if (Number.isFinite(spawnX) && Number.isFinite(spawnY)) {
        const seq = Date.now();
        this.sendCmd("CmdMove", {
          playerId: this.playerId,
          fromX: Math.round(this.x),
          fromY: Math.round(this.y),
          toX: Math.round(spawnX),
          toY: Math.round(spawnY),
          seq,
        });
        this.x = Math.round(spawnX);
        this.y = Math.round(spawnY);
      }
      this.startTimers();
      return;
    }

    if (msg?.t === "EvMapResources" && msg.mapId === this.mapId) {
      this.resources = Array.isArray(msg.resources) ? msg.resources : [];
    }

    if (msg?.t === "EvMapMonsters" && msg.mapId === this.mapId) {
      this.monsters = Array.isArray(msg.monsters) ? msg.monsters : [];
    }

    if (msg?.t === "EvMoveStart" && msg.playerId === this.playerId) {
      if (Number.isFinite(msg.toX)) this.x = msg.toX;
      if (Number.isFinite(msg.toY)) this.y = msg.toY;
    }

    if (msg?.t === "EvPlayerMap" && msg.playerId === this.playerId) {
      if (typeof msg.mapId === "string") this.mapId = msg.mapId;
      if (Number.isFinite(msg.tileX)) this.x = msg.tileX;
      if (Number.isFinite(msg.tileY)) this.y = msg.tileY;
    }

    if (msg?.t === "EvCombatCreated") {
      if (Array.isArray(msg.participantIds) && msg.participantIds.includes(this.playerId)) {
        this.inCombat = true;
        this.combatId = msg.combatId ?? null;
      }
    }

    if (msg?.t === "EvCombatUpdated") {
      if (Array.isArray(msg.participantIds) && msg.participantIds.includes(this.playerId)) {
        this.inCombat = true;
        this.combatId = msg.combatId ?? this.combatId;
      }
      if (msg?.phase === "combat") {
        this.inCombat = true;
      }
    }

    if (msg?.t === "EvCombatEnded") {
      if (msg.combatId === this.combatId) {
        this.inCombat = false;
        this.combatId = null;
      }
    }

    if (msg?.t === "EvCombatTurnStarted") {
      if (!this.inCombat) return;
      if (msg.actorType !== "player") return;
      if (msg.activePlayerId !== this.playerId) return;
      const combatId = msg.combatId ?? this.combatId;
      if (!combatId) return;
      setTimeout(() => {
        this.sendCmd("CmdEndTurnCombat", {
          playerId: this.playerId,
          combatId,
          actorType: "player",
        });
      }, randomDelay(400, 200));
    }
  }

  startTimers() {
    this.stopTimers();

    const requestMapTimer = setInterval(() => {
      if (!this.playerId || !this.mapId) return;
      this.sendCmd("CmdRequestMapResources", {
        playerId: this.playerId,
        mapId: this.mapId,
      });
      this.sendCmd("CmdRequestMapMonsters", {
        playerId: this.playerId,
        mapId: this.mapId,
      });
    }, randomDelay(3500, 1200));

    const moveTimer = setInterval(() => {
      if (!this.playerId || this.inCombat) return;
      if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) return;
      let target = null;
      if (this.resources.length > 0) {
        const candidates = this.resources.filter((r) => r && !r.harvested);
        if (candidates.length > 0) {
          target = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }
      if (!target && this.monsters.length > 0) {
        target = this.monsters[Math.floor(Math.random() * this.monsters.length)];
      }
      const toX = Number.isFinite(target?.tileX)
        ? target.tileX
        : Math.round(this.x + (Math.random() * 4 - 2));
      const toY = Number.isFinite(target?.tileY)
        ? target.tileY
        : Math.round(this.y + (Math.random() * 4 - 2));
      const seq = Date.now();
      this.sendCmd("CmdMove", {
        playerId: this.playerId,
        fromX: Math.round(this.x),
        fromY: Math.round(this.y),
        toX,
        toY,
        seq,
      });
    }, randomDelay(900, 400));

    const harvestTimer = setInterval(() => {
      if (!this.playerId || !this.mapId || this.inCombat) return;
      const available = this.resources.filter((r) => r && !r.harvested);
      if (available.length === 0) return;
      const target = available[Math.floor(Math.random() * available.length)];
      if (!target || !Number.isInteger(target.entityId)) return;
      this.sendCmd("CmdResourceHarvest", {
        playerId: this.playerId,
        mapId: this.mapId,
        entityId: target.entityId,
      });
    }, randomDelay(6500, 2000));

    const combatTimer = setInterval(() => {
      if (!this.playerId || !this.mapId || this.inCombat) return;
      if (this.monsters.length === 0) return;
      if (Math.random() > 0.2) return;
      const target = this.monsters[Math.floor(Math.random() * this.monsters.length)];
      if (!target || !Number.isInteger(target.entityId)) return;
      this.sendCmd("CmdCombatStart", {
        playerId: this.playerId,
        mapId: this.mapId,
        participantIds: [],
        mobEntityIds: [target.entityId],
      });
    }, randomDelay(12000, 4000));

    const readyTimer = setInterval(() => {
      if (!this.playerId || !this.inCombat || !this.combatId) return;
      this.sendCmd("CmdCombatReady", {
        playerId: this.playerId,
        combatId: this.combatId,
      });
    }, randomDelay(3000, 1200));

    const mapPlayersTimer = setInterval(() => {
      if (!this.playerId || !this.mapId) return;
      this.sendCmd("CmdRequestMapPlayers", {
        playerId: this.playerId,
        mapId: this.mapId,
      });
    }, randomDelay(4500, 1500));

    this.timers.push(
      requestMapTimer,
      moveTimer,
      harvestTimer,
      combatTimer,
      readyTimer,
      mapPlayersTimer
    );
  }

  stopTimers() {
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers = [];
  }

  cleanup() {
    this.stopTimers();
  }
}

const bots = [];
for (let i = 1; i <= count; i += 1) {
  const bot = new BotClient(i);
  bots.push(bot);
  setTimeout(() => bot.start(), i * 120);
}

process.on("SIGINT", () => {
  bots.forEach((bot) => bot.cleanup());
  process.exit(0);
});

