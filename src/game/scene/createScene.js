import { defaultMapKey, maps } from "../../features/maps/index.js";
import { rebuildDebugGrid, initWorldExitsForScene } from "../../features/maps/world.js";
import { createMapExits } from "../../features/maps/exits.js";
import { onAfterMapLoaded } from "../../features/dungeons/hooks.js";
import { getSelectedCharacter } from "../../app/session.js";
import { buildInitialMap } from "./sceneMap.js";
import { setupPlayerForScene } from "./scenePlayer.js";
import { initRuntime } from "../runtime/initRuntime.js";
import { spawnWorldEntities } from "../world/spawnWorld.js";
import { setupHudAndCameras, initDomUi } from "../ui/initUi.js";
import { setupSceneInput } from "../input/setupInput.js";
import { initLanRuntime } from "../../net/lanRuntime.js";

export function createMainScene(scene) {
  const selected = getSelectedCharacter() || null;
  const snapshot = null;
  const requestedMapKey = defaultMapKey;
  const mapDef = maps[requestedMapKey] || maps[defaultMapKey];

  const mapState = buildInitialMap(scene, mapDef, snapshot);

  const player = setupPlayerForScene(scene, {
    startX: mapState.startX,
    startY: mapState.startY,
    startTileX: mapState.startTileX,
    startTileY: mapState.startTileY,
    snapshot,
    selected,
  });

  initRuntime(scene, player);
  initWorldExitsForScene(scene);

  spawnWorldEntities(
    scene,
    mapState.map,
    mapState.groundLayer,
    mapDef,
    mapState.centerTileX,
    mapState.centerTileY
  );

  const grid = rebuildDebugGrid(
    scene,
    mapState.map,
    mapState.groundLayer,
    mapState.mapLayers
  );

  const hudY = setupHudAndCameras(
    scene,
    mapState.map,
    mapState.mapLayers,
    mapState.startX,
    mapState.startY,
    mapDef,
    grid
  );

  createMapExits(scene);
  onAfterMapLoaded(scene);

  setupSceneInput(scene, hudY, mapState.map, mapState.groundLayer);
  initDomUi(scene, player);
  initLanRuntime(scene, player, mapState.map, mapState.groundLayer);
}
