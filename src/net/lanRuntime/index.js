import {
  getNetClient,
  getNetIsHost,
  getNetPlayerId,
  setNetEventHandler,
  setNetIsHost,
} from "../../app/session.js";
import { createCalibratedWorldToTile } from "../../features/maps/world/util.js";
import { on as onStoreEvent } from "../../state/store.js";
import { createCombatHandlers } from "./combat/index.js";
import { createPlayerHandlers } from "./players.js";
import { createMobHandlers } from "./mobs.js";
import { createResourceHandlers } from "./resources.js";
import { createCombatUiHandlers } from "./ui.js";
import { spawnMonstersFromEntries } from "../../features/monsters/runtime/index.js";

export function initLanRuntime(scene, player, map, groundLayer) {
  const remotePlayers = new Map();
  const remotePlayersData = new Map();
  scene.__lanRemotePlayers = remotePlayers;
  const activeCombats = new Map();
  scene.__lanActiveCombats = activeCombats;
  const combatJoinMarkers = new Map();
  scene.__lanCombatJoinMarkers = combatJoinMarkers;
  scene.__lanCombatId = null;
  const resourceNodes = new Map();
  scene.__lanResourceNodes = resourceNodes;

  const worldToTile = createCalibratedWorldToTile(map, groundLayer);
  const getCurrentMapKey = () => scene?.currentMapKey || null;
  const getCurrentMapDef = () => scene?.currentMapDef || null;
  const getCurrentMapObj = () => scene?.map || null;
  const getCurrentGroundLayer = () => scene?.groundLayer || null;
  const isSceneReady = () =>
    !!(scene && scene.sys && !scene.sys.isDestroyed && scene.add && scene.physics);
  const isMapReady = () => {
    const currentMap = getCurrentMapObj();
    const currentLayer = getCurrentGroundLayer();
    return !!(currentMap && currentLayer && currentLayer.layer);
  };
  const netDebugLog = (...args) => {
    if (
      typeof window === "undefined" ||
      (window.LAN_COMBAT_DEBUG !== true && window.LAN_COMBAT_DEBUG !== "1")
    ) {
      return;
    }
    // eslint-disable-next-line no-console
    console.log("[LAN][Net]", ...args);
  };
  let lastEventId = 0;
  let pendingAckEventId = 0;
  let ackTimer = null;
  const combatEventTypes = new Set([
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
  const combatSeqState = new Map();

  const scheduleAck = () => {
    if (ackTimer) return;
    ackTimer = setTimeout(() => {
      ackTimer = null;
      const client = getNetClient();
      if (!client || pendingAckEventId <= 0) return;
      client.sendCmd("CmdAck", { lastEventId: pendingAckEventId });
    }, 200);
  };

  const ui = createCombatUiHandlers({
    scene,
    activeCombats,
    combatJoinMarkers,
    getCurrentMapKey,
    getCurrentMapObj,
    getCurrentGroundLayer,
    isSceneReady,
  });
  ui.initCombatWatchUi();

  const players = createPlayerHandlers({
    scene,
    player,
    map,
    groundLayer,
    worldToTile,
    remotePlayers,
    remotePlayersData,
    getCurrentMapKey,
    isSceneReady,
  });

  const mobs = createMobHandlers({
    scene,
    player,
    map,
    groundLayer,
    getCurrentMapKey,
    getCurrentMapDef,
    getCurrentMapObj,
    getCurrentGroundLayer,
  });

  const resources = createResourceHandlers({
    scene,
    player,
    getCurrentMapKey,
    getCurrentMapDef,
    getCurrentMapObj,
    resourceNodes,
  });

  const combat = createCombatHandlers({
    scene,
    player,
    activeCombats,
    remotePlayersData,
    remotePlayers,
    getCurrentMapKey,
    getCurrentMapObj,
    getCurrentGroundLayer,
    isSceneReady,
    findWorldMonsterByEntityId: mobs.findWorldMonsterByEntityId,
    removeWorldMonsterByEntityId: mobs.removeWorldMonsterByEntityId,
    refreshRemoteSprites: players.refreshRemoteSprites,
    updateCombatWatchUi: ui.updateCombatWatchUi,
    refreshMapMonstersFromServer: mobs.refreshMapMonstersFromServer,
    removeCombatJoinMarker: ui.removeCombatJoinMarker,
    stopEntityMovement: players.stopEntityMovement,
  });

  const sendMapChange = () => {
    const client = getNetClient();
    if (!client) return;
    const playerId = getNetPlayerId();
    if (!playerId) return;
    const currentMap = getCurrentMapKey();
    if (!currentMap) return;
    if (
      !Number.isInteger(player?.currentTileX) ||
      !Number.isInteger(player?.currentTileY)
    ) {
      return;
    }
    client.sendCmd("CmdMapChange", {
      playerId,
      mapId: currentMap,
      tileX: player.currentTileX,
      tileY: player.currentTileY,
    });
  };

  const initialSync = () => {
    const client = getNetClient();
    if (!client) return;
    const playerId = getNetPlayerId();
    if (!playerId) return;
    if (!Number.isInteger(player?.currentTileX) || !Number.isInteger(player?.currentTileY)) {
      return;
    }
    client.sendCmd("CmdMove", {
      playerId,
      toX: player.currentTileX,
      toY: player.currentTileY,
    });
    sendMapChange();
    mobs.sendMapMonstersSnapshot();
    mobs.requestMapMonsters();
    resources.sendMapResourcesSnapshot();
    resources.requestMapResources();
  };

  initialSync();

  const applyCombatEvent = (msg) => {
    if (msg.t === "EvCombatMoveStart") {
      combat.handleCombatMoveStart(msg);
      combat.requestCombatStateFlush();
      return;
    }

    if (msg.t === "EvCombatMonsterMoveStart") {
      combat.handleCombatMonsterMoveStart(msg);
      combat.requestCombatStateFlush();
      return;
    }

    if (msg.t === "EvCombatState") {
      combat.applyCombatState(msg);
      return;
    }

    if (msg.t === "EvSpellCast") {
      combat.handleCombatSpellCast(msg);
      combat.requestCombatStateFlush();
      return;
    }

    if (msg.t === "EvDamageApplied") {
      combat.handleCombatDamageApplied(msg);
      combat.requestCombatStateFlush();
      return;
    }

    if (msg.t === "EvCombatTurnStarted") {
      combat.applyCombatTurnStarted(msg);
      combat.requestCombatStateFlush();
      return;
    }

    if (msg.t === "EvCombatTurnEnded") {
      combat.applyCombatTurnEnded(msg);
      combat.requestCombatStateFlush();
      return;
    }

    if (msg.t === "EvCombatUpdated") {
      combat.applyCombatUpdated(msg);
      combat.requestCombatStateFlush();
      return;
    }

    if (msg.t === "EvCombatJoinReady") {
      combat.handleCombatJoinReady(msg);
      combat.requestCombatStateFlush();
      return;
    }

    if (msg.t === "EvCombatCreated") {
      combat.applyCombatCreated(msg);
      return;
    }

    if (msg.t === "EvCombatEnded") {
      combat.applyCombatEnded(msg);
      if (Number.isInteger(msg.combatId)) {
        combatSeqState.delete(msg.combatId);
      }
    }
  };

  const handleCombatSequencedEvent = (msg) => {
    const combatId = Number.isInteger(msg.combatId) ? msg.combatId : null;
    if (combatId === null || !Number.isInteger(msg.combatSeq)) {
      applyCombatEvent(msg);
      return;
    }
    const state = combatSeqState.get(combatId) || {
      expected: null,
      pending: new Map(),
      replayRequested: false,
    };
    if (state.expected === null) {
      state.expected = msg.combatSeq;
    }
    if (msg.combatSeq < state.expected) {
      combatSeqState.set(combatId, state);
      return;
    }
    if (msg.combatSeq > state.expected) {
      if (state.pending.size < 200) {
        state.pending.set(msg.combatSeq, msg);
      }
      if (!state.replayRequested) {
        const client = getNetClient();
        if (client) {
          client.sendCmd("CmdCombatReplay", { combatId, fromSeq: state.expected });
          state.replayRequested = true;
        }
      }
      combatSeqState.set(combatId, state);
      return;
    }

    let nextMsg = msg;
    while (nextMsg) {
      applyCombatEvent(nextMsg);
      state.pending.delete(state.expected);
      state.expected += 1;
      nextMsg = state.pending.get(state.expected) || null;
    }
    if (state.replayRequested && state.pending.size === 0) {
      state.replayRequested = false;
    }
    combatSeqState.set(combatId, state);
  };

  setNetEventHandler((msg) => {
    if (!msg || !player) return;
    if (Number.isInteger(msg.eventId)) {
      if (msg.eventId === lastEventId + 1) {
        lastEventId = msg.eventId;
        pendingAckEventId = lastEventId;
        scheduleAck();
      }
    }
    if (msg.t === "EvCombatMonsterMoveStart") {
      netDebugLog("recv EvCombatMonsterMoveStart", {
        combatId: msg.combatId ?? null,
        entityId: msg.entityId ?? null,
        combatIndex: msg.combatIndex ?? null,
        steps: Array.isArray(msg.path) ? msg.path.length : null,
        mapId: msg.mapId ?? null,
      });
    }

    if (msg.t === "EvMoveStart" || msg.t === "EvMoved") {
      players.handleMoveEvent(msg);
      return;
    }

    if (msg.t === "EvWelcome") {
      if (typeof msg.isHost === "boolean") {
        setNetIsHost(msg.isHost);
      }
      if (player && Number.isInteger(msg.playerId)) {
        player.netId = msg.playerId;
      }
      const snapshot = msg.snapshot || null;
      const playersSnapshot = snapshot?.players || [];
      if (player && Number.isInteger(msg.playerId)) {
        const localEntry = playersSnapshot.find((p) => Number(p?.id) === msg.playerId) || null;
        if (localEntry && player.stats) {
          const hpMax = Number.isFinite(localEntry.hpMax)
            ? localEntry.hpMax
            : Number.isFinite(localEntry.hp)
              ? localEntry.hp
              : null;
          if (Number.isFinite(hpMax)) {
            const hp = Number.isFinite(localEntry.hp) ? localEntry.hp : hpMax;
            player.stats.hpMax = hpMax;
            player.stats.hp = Math.min(hp, hpMax);
            if (typeof player.updateHudHp === "function") {
              player.updateHudHp(player.stats.hp, player.stats.hpMax);
            }
          }
        }
      }
      playersSnapshot.forEach((entry) => players.upsertRemoteData(entry));
      const combats = Array.isArray(snapshot?.combats) ? snapshot.combats : [];
      combats.forEach((entry) => combat.applyCombatCreated(entry));
      players.refreshRemoteSprites();
      ui.updateCombatWatchUi();
      sendMapChange();
      if (getNetIsHost()) {
        mobs.sendMapMonstersSnapshot();
        resources.sendMapResourcesSnapshot();
      }
      mobs.requestMapMonsters();
      resources.requestMapResources();
      mobs.updateHostMobScheduler();
      return;
    }

    if (msg.t === "EvPlayerJoined") {
      players.upsertRemoteData(msg.player);
      players.refreshRemoteSprites();
      return;
    }

    if (msg.t === "EvPlayerLeft") {
      players.removeRemotePlayer(msg.playerId);
      return;
    }

    if (msg.t === "EvPlayerMap") {
      players.upsertRemoteData({
        id: msg.playerId,
        mapId: msg.mapId,
        x: msg.tileX,
        y: msg.tileY,
      });
      const remote = remotePlayers.get(msg.playerId) || null;
      if (remote) remote.mapId = msg.mapId || null;
      players.refreshRemoteSprites();
      return;
    }

    if (msg.t === "EvHostChanged") {
      const playerId = getNetPlayerId();
      if (Number.isInteger(msg.hostId) && playerId) {
        setNetIsHost(msg.hostId === playerId);
      } else {
        setNetIsHost(false);
      }
      if (getNetIsHost()) {
        mobs.sendMapMonstersSnapshot();
        resources.sendMapResourcesSnapshot();
      }
      mobs.requestMapMonsters();
      resources.requestMapResources();
      mobs.updateHostMobScheduler();
      return;
    }

    if (msg.t === "EvMapMonsters") {
      if (scene?.combatState?.enCours) return;
      if (!isMapReady()) {
        scene.__lanPendingMapMonsters = msg;
        if (!scene.__lanPendingMapMonstersTimer) {
          const schedule = (fn) =>
            scene.time && typeof scene.time.delayedCall === "function"
              ? scene.time.delayedCall(100, fn)
              : setTimeout(fn, 100);
          scene.__lanPendingMapMonstersTimer = schedule(() => {
            scene.__lanPendingMapMonstersTimer = null;
            const pending = scene.__lanPendingMapMonsters;
            if (pending) {
              scene.__lanPendingMapMonsters = null;
              applyCombatEvent(pending);
            }
          });
        }
        return;
      }
      const currentMap = getCurrentMapKey();
      if (!currentMap || msg.mapId !== currentMap) return;
      mobs.clearWorldMonsters();
      const entries = Array.isArray(msg.monsters) ? msg.monsters : [];
      spawnMonstersFromEntries(scene, scene.map, scene.groundLayer, entries, {
        disableRoam: true,
      });
      mobs.updateHostMobScheduler();
      return;
    }

    if (msg.t === "EvMapResources") {
      if (!isMapReady()) {
        scene.__lanPendingMapResources = msg;
        if (!scene.__lanPendingMapResourcesTimer) {
          const schedule = (fn) =>
            scene.time && typeof scene.time.delayedCall === "function"
              ? scene.time.delayedCall(100, fn)
              : setTimeout(fn, 100);
          scene.__lanPendingMapResourcesTimer = schedule(() => {
            scene.__lanPendingMapResourcesTimer = null;
            const pending = scene.__lanPendingMapResources;
            if (pending) {
              scene.__lanPendingMapResources = null;
              applyCombatEvent(pending);
            }
          });
        }
        return;
      }
      const currentMap = getCurrentMapKey();
      if (!currentMap || msg.mapId !== currentMap) return;
      const entries = Array.isArray(msg.resources) ? msg.resources : [];
      resources.spawnResourcesFromEntries(entries);
      return;
    }

    if (msg.t === "EvMobMoveStart") {
      mobs.handleMobMoveStart(msg);
      return;
    }

    if (msg.t === "EvMobMoveEnd") {
      mobs.handleMobMoveEnd(msg);
      return;
    }

    if (msg.t === "EvMobDeath") {
      const currentMap = getCurrentMapKey();
      if (!currentMap || msg.mapId !== currentMap) return;
      mobs.removeWorldMonsterByEntityId(msg.entityId);
      return;
    }

    if (msg.t === "EvMobRespawn") {
      const currentMap = getCurrentMapKey();
      if (!currentMap || msg.mapId !== currentMap) return;
      const entry = msg.monster || null;
      if (!entry || !Number.isInteger(entry.entityId)) return;
      if (entry && Number.isInteger(entry.entityId)) {
        mobs.removeWorldMonsterByEntityId(entry.entityId);
      }
      spawnMonstersFromEntries(scene, scene.map, scene.groundLayer, [entry], {
        disableRoam: true,
      });
      return;
    }

    if (msg.t === "EvResourceHarvested") {
      resources.handleResourceHarvested(msg);
      return;
    }

    if (msg.t === "EvResourceRespawned") {
      resources.handleResourceRespawned(msg);
      return;
    }

    if (msg.t === "EvEnsureMapInit") {
      const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
      if (!mapId) return;
      const currentMap = getCurrentMapKey();
      if (currentMap !== mapId) return;
      mobs.sendMapMonstersSnapshot();
      resources.sendMapResourcesSnapshot();
      return;
    }

    if (combatEventTypes.has(msg.t)) {
      handleCombatSequencedEvent(msg);
      return;
    }

  });

  onStoreEvent("map:changed", (payload) => {
    if (!payload?.mapKey) return;
    sendMapChange();
    players.refreshRemoteSprites();
    mobs.sendMapMonstersSnapshot();
    mobs.requestMapMonsters();
    resources.clearResourceNodes();
    resources.sendMapResourcesSnapshot();
    resources.requestMapResources();
    mobs.updateHostMobScheduler();
    ui.clearCombatJoinMarkers();
    ui.updateCombatWatchUi();
  });
}
