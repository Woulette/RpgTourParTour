import { setNetEventHandler } from "../../app/session.js";
import { createCalibratedWorldToTile } from "../../features/maps/world/util.js";
import { on as onStoreEvent } from "../../state/store.js";
import { createCombatHandlers } from "./combat/index.js";
import { createPlayerHandlers } from "./players.js";
import { createMobHandlers } from "./mobs.js";
import { createResourceHandlers } from "./resources.js";
import { createCombatUiHandlers } from "./ui.js";
import { createLanRouter } from "./router.js";
import { createLanBootHandlers } from "./boot.js";
import { createLanPersistenceHandlers } from "./persistence.js";
import { createGroupHandlers } from "./groups.js";

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

  const groups = createGroupHandlers({
    scene,
    getCurrentMapKey,
    isSceneReady,
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
    requestMapPlayers: players.requestMapPlayers,
    updateCombatWatchUi: ui.updateCombatWatchUi,
    refreshMapMonstersFromServer: mobs.refreshMapMonstersFromServer,
    removeCombatJoinMarker: ui.removeCombatJoinMarker,
    stopEntityMovement: players.stopEntityMovement,
  });

  const boot = createLanBootHandlers({
    player,
    mobs,
    resources,
    players,
    ui,
    getCurrentMapKey,
  });

  const initialSyncOnce = (() => {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      boot.initialSync({ skipMove: true });
    };
  })();

  createLanPersistenceHandlers(player);

  const router = createLanRouter({
    scene,
    player,
    ui,
    players,
    mobs,
    resources,
    combat,
    groups,
    sendMapChange: boot.sendMapChange,
    getCurrentMapKey,
    getCurrentMapObj,
    getCurrentGroundLayer,
    isMapReady,
    netDebugLog,
    remotePlayers,
    onWelcomeReady: initialSyncOnce,
  });

  setNetEventHandler(router);

  onStoreEvent("map:changed", (payload) => {
    boot.handleMapChanged(payload);
    groups.handleMapChanged(payload);
  });
}
