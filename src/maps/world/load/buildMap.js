import { buildMap } from "../../loader.js";
import { rebuildCollisionGridFromMap } from "../collision.js";
import { rebuildDebugGrid } from "../debugGrid.js";
import { spawnObjectLayerTrees } from "../decor.js";
import { setupWorkstations } from "../../../metier/workstations.js";

export function applyCustomLayerDepths(scene) {
  if (!scene || !Array.isArray(scene.mapLayers)) return;

  const layers = scene.mapLayers.filter((l) => l && typeof l.setDepth === "function");
  const meta = layers.map((layer, index) => {
    const rawName =
      (
        layer.name ||
        (layer.layer && layer.layer.name) ||
        (layer.tilemapLayer && layer.tilemapLayer.layer?.name) ||
        ""
      )
        .toLowerCase()
        .trim();
    return { layer, index, rawName };
  });

  const isCanopyLayerName = (rawName) => {
    if (!rawName) return false;
    if (rawName.includes("canopy")) return true;
    if (rawName.includes("feuillage")) return true;
    const m = rawName.match(/calque\s+de\s+tuiles\s*(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n >= 5) return true;
    }
    return false;
  };

  meta.forEach(({ layer, index, rawName }) => {
    if (rawName.includes("tronc")) return;
    if (isCanopyLayerName(rawName)) return;
    layer.setDepth(index);
  });

  let maxGroundDepth = 0;
  meta.forEach(({ layer, rawName }) => {
    if (rawName.includes("tronc")) return;
    if (isCanopyLayerName(rawName)) return;
    const d = layer.depth;
    if (typeof d === "number" && d > maxGroundDepth) maxGroundDepth = d;
  });

  scene.maxGroundDepth = maxGroundDepth;

  meta.forEach(({ layer, rawName }) => {
    if (rawName.includes("tronc")) {
      layer.setDepth(maxGroundDepth + 0.5);
    }
  });

  meta.forEach(({ layer, rawName }) => {
    if (isCanopyLayerName(rawName)) {
      layer.setDepth(100000);
    }
  });
}

export function buildSceneMap(scene, mapDef) {
  const { map, groundLayer, layers } = buildMap(scene, mapDef);
  const mapLayers = layers && layers.length > 0 ? layers : [groundLayer];
  mapLayers.forEach((layer) => layer.setOrigin(0, 0));

  if (scene.hudCamera?.ignore) {
    mapLayers.forEach((layer) => scene.hudCamera.ignore(layer));
  }

  scene.map = map;
  scene.groundLayer = groundLayer || mapLayers[0];
  scene.mapLayers = mapLayers;
  scene.currentMapKey = mapDef.key;
  scene.currentMapDef = mapDef;

  applyCustomLayerDepths(scene);

  rebuildCollisionGridFromMap(scene, map, scene.groundLayer);
  spawnObjectLayerTrees(scene, map, "trees", "staticTrees");
  spawnObjectLayerTrees(scene, map, "decor", "staticDecor");
  setupWorkstations(scene, map, scene.groundLayer, mapDef);
  rebuildDebugGrid(scene, map, scene.groundLayer, mapLayers);

  return { map, groundLayer: scene.groundLayer, mapLayers };
}
