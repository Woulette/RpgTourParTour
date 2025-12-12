import {
  blockTile,
  ensureCollisionState,
} from "../../collision/collisionGrid.js";
import { createCalibratedWorldToTile } from "./util.js";

// Construit la grille de collisions ‡ partir du calque d'objets "collisions"/"Collisions".
export function rebuildCollisionGridFromMap(scene, map, groundLayer) {
  if (!scene || !map || !groundLayer) return;

  // Reset collision state
  scene.collision = { blockedTiles: new Set() };
  ensureCollisionState(scene);

  const layer =
    map.getObjectLayer("collisions") || map.getObjectLayer("Collisions");
  if (!layer || !Array.isArray(layer.objects)) return;

  const getProp = (obj, name) => {
    if (!obj || !obj.properties) return undefined;
    const p = obj.properties.find((prop) => prop.name === name);
    return p ? p.value : undefined;
  };

  const worldToTile = createCalibratedWorldToTile(map, groundLayer);

  const blockRect = (obj) => {
    // --- Mode "tile-based" : l'objet fournit directement ses coord. en tuiles ---
    const tileXProp = getProp(obj, "tileX");
    const tileYProp = getProp(obj, "tileY");
    const tilesWide =
      getProp(obj, "tilesWide") ??
      getProp(obj, "tilesW") ??
      getProp(obj, "widthTiles");
    const tilesHigh =
      getProp(obj, "tilesHigh") ??
      getProp(obj, "tilesH") ??
      getProp(obj, "heightTiles");

    if (typeof tileXProp === "number" && typeof tileYProp === "number") {
      const startX = Math.floor(tileXProp);
      const startY = Math.floor(tileYProp);
      const widthInTiles =
        typeof tilesWide === "number" ? Math.max(1, Math.round(tilesWide)) : 1;
      const heightInTiles =
        typeof tilesHigh === "number" ? Math.max(1, Math.round(tilesHigh)) : 1;

      for (let ty = startY; ty < startY + heightInTiles; ty++) {
        for (let tx = startX; tx < startX + widthInTiles; tx++) {
          if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
            blockTile(scene, tx, ty);
          }
        }
      }
      return;
    }

    // --- Fallback : rectangles dÈfinis en pixels (coord. monde Tiled) ---
    if (
      typeof obj.x !== "number" ||
      typeof obj.y !== "number" ||
      typeof obj.width !== "number" ||
      typeof obj.height !== "number"
    ) {
      return;
    }

    // En isomÈtrique, les rectangles d'objets Tiled sont positionnÈs
    // par leur coin bas (centre horizontal). On reconstruit la bbox rÈelle.
    const left = obj.x - obj.width / 2;
    const right = obj.x + obj.width / 2;
    const top = obj.y - obj.height;
    const bottom = obj.y;

    const corners = [
      worldToTile(left, top),
      worldToTile(right, top),
      worldToTile(left, bottom),
      worldToTile(right, bottom),
    ].filter(Boolean);

    if (corners.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    corners.forEach(({ x, y }) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
          blockTile(scene, tx, ty);
        }
      }
    }
  };

  layer.objects.forEach(blockRect);

  // Collision issues directement des shapes de tuiles (Èditeur de collision Tiled sur les tilesets).
  const layersToScan = Array.isArray(scene.mapLayers)
    ? scene.mapLayers
    : groundLayer
    ? [groundLayer]
    : [];

  layersToScan.forEach((tileLayer) => {
    if (!tileLayer || !tileLayer.forEachTile) return;
    tileLayer.forEachTile((tile) => {
      if (!tile || tile.index < 0 || !tile.tileset) return;

      // RÈcupËre les mÈtadonnÈes de tuile : en Phaser, tile.index est global.
      let data =
        (tile.tileset.getTileData && tile.tileset.getTileData(tile.index)) ||
        tile.tileset.tileData?.[tile.index];
      if (!data && tile.tileset.firstgid) {
        const localIndex = tile.index - tile.tileset.firstgid;
        data = tile.tileset.tileData?.[localIndex];
      }

      const hasShapes =
        data &&
        data.objectgroup &&
        Array.isArray(data.objectgroup.objects) &&
        data.objectgroup.objects.length > 0;
      if (hasShapes) {
        blockTile(scene, tile.x, tile.y);
      }
    });
  });
}
