import { buildMap } from "../../maps/loader.js";
import { applyCustomLayerDepths, rebuildCollisionGridFromMap, spawnObjectLayerTrees } from "../../maps/world.js";
import { setupWorkstations } from "../../metier/workstations.js";

export function buildInitialMap(scene, mapDef, snapshot) {
  const { map, groundLayer, layers } = buildMap(scene, mapDef);

  const mapLayers =
    Array.isArray(layers) && layers.length > 0
      ? layers.filter(Boolean)
      : [groundLayer].filter(Boolean);
  mapLayers.forEach((layer) => {
    if (layer && typeof layer.setOrigin === "function") {
      layer.setOrigin(0, 0);
    }
  });

  scene.map = map;
  scene.groundLayer = groundLayer;
  scene.mapLayers = mapLayers;
  scene.currentMapKey = mapDef.key;
  scene.currentMapDef = mapDef;
  applyCustomLayerDepths(scene);

  rebuildCollisionGridFromMap(scene, map, groundLayer);
  spawnObjectLayerTrees(scene, map, "trees", "staticTrees");
  spawnObjectLayerTrees(scene, map, "decor", "staticDecor");
  setupWorkstations(scene, map, groundLayer, mapDef);

  const centerTileX = Math.floor(map.width / 2);
  const centerTileY = Math.floor(map.height / 2);

  const desiredTile =
    snapshot && Number.isFinite(snapshot.tileX) && Number.isFinite(snapshot.tileY)
      ? { x: snapshot.tileX, y: snapshot.tileY }
      : mapDef && mapDef.startTile && typeof mapDef.startTile.x === "number"
      ? mapDef.startTile
      : null;

  const startTileX =
    desiredTile && desiredTile.x >= 0 && desiredTile.x < map.width
      ? desiredTile.x
      : centerTileX;
  const startTileY =
    desiredTile && desiredTile.y >= 0 && desiredTile.y < map.height
      ? desiredTile.y
      : centerTileY;

  const centerWorld = map.tileToWorldXY(
    startTileX,
    startTileY,
    undefined,
    undefined,
    groundLayer
  );

  const startX = centerWorld.x + map.tileWidth / 2;
  const startY = centerWorld.y + map.tileHeight / 2;

  return {
    map,
    groundLayer,
    mapLayers,
    centerTileX,
    centerTileY,
    startTileX,
    startTileY,
    startX,
    startY,
  };
}
