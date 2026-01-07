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

  setNetEventHandler((msg) => {
    if (!msg || !player) return;

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
      if (!mapId || !getNetIsHost()) return;
      const currentMap = getCurrentMapKey();
      if (currentMap !== mapId) return;
      mobs.sendMapMonstersSnapshot();
      resources.sendMapResourcesSnapshot();
      return;
    }

    if (msg.t === "EvCombatMoveStart") {
      combat.handleCombatMoveStart(msg);
      return;
    }

    if (msg.t === "EvCombatMonsterMoveStart") {
      combat.handleCombatMonsterMoveStart(msg);
      return;
    }

    if (msg.t === "EvCombatState") {
      combat.applyCombatState(msg);
      return;
    }

    if (msg.t === "EvSpellCast") {
      combat.handleCombatSpellCast(msg);
      return;
    }

    if (msg.t === "EvDamageApplied") {
      combat.handleCombatDamageApplied(msg);
      return;
    }

    if (msg.t === "EvCombatTurnStarted") {
      combat.applyCombatTurnStarted(msg);
      return;
    }

    if (msg.t === "EvCombatTurnEnded") {
      combat.applyCombatTurnEnded(msg);
      return;
    }

    if (msg.t === "EvCombatUpdated") {
      combat.applyCombatUpdated(msg);
      return;
    }

    if (msg.t === "EvCombatJoinReady") {
      combat.handleCombatJoinReady(msg);
      return;
    }

    if (msg.t === "EvCombatCreated") {
      combat.applyCombatCreated(msg);
      return;
    }

    if (msg.t === "EvCombatEnded") {
      combat.applyCombatEnded(msg);
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
