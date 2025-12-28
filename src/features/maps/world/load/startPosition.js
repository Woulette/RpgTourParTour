import { isTileBlocked } from "../../../../collision/collisionGrid.js";

function hasGroundTile(groundLayer, tileX, tileY) {
  if (!groundLayer || typeof groundLayer.getTileAt !== "function") return true;
  const t = groundLayer.getTileAt(tileX, tileY);
  return !!(t && typeof t.index === "number" && t.index >= 0);
}

function findNearestSpawnableTile(scene, map, groundLayer, startX, startY) {
  if (!map || !groundLayer) return { x: startX, y: startY };
  const maxRadius = Math.max(map.width, map.height);

  const isOk = (x, y) => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    if (!hasGroundTile(groundLayer, x, y)) return false;
    if (isTileBlocked(scene, x, y)) return false;
    return true;
  };

  if (isOk(startX, startY)) return { x: startX, y: startY };

  for (let r = 1; r <= maxRadius; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = startX + dx;
        const y = startY + dy;
        if (isOk(x, y)) return { x, y };
      }
    }
  }

  return { x: startX, y: startY };
}

export function computeStartPosition(scene, map, mapDef, options = {}) {
  const desiredTile =
    (options?.startTile &&
      typeof options.startTile.x === "number" &&
      typeof options.startTile.y === "number" &&
      options.startTile) ||
    (options?.forceExactStartTile &&
      mapDef.dungeonReturnTile &&
      typeof mapDef.dungeonReturnTile.x === "number" &&
      typeof mapDef.dungeonReturnTile.y === "number" &&
      mapDef.dungeonReturnTile) ||
    mapDef.startTile ||
    null;

  const fallbackTileX = Math.floor(map.width / 2);
  const fallbackTileY = Math.floor(map.height / 2);

  const startTileX =
    desiredTile && desiredTile.x >= 0 && desiredTile.x < map.width
      ? desiredTile.x
      : fallbackTileX;
  const startTileY =
    desiredTile && desiredTile.y >= 0 && desiredTile.y < map.height
      ? desiredTile.y
      : fallbackTileY;

  let safeStartTileX = startTileX;
  let safeStartTileY = startTileY;
  if (
    mapDef.key === "MapAndemiaNouvelleVersion9" &&
    safeStartTileX === 0 &&
    safeStartTileY === 0 &&
    mapDef.dungeonReturnTile &&
    typeof mapDef.dungeonReturnTile.x === "number" &&
    typeof mapDef.dungeonReturnTile.y === "number"
  ) {
    safeStartTileX = mapDef.dungeonReturnTile.x;
    safeStartTileY = mapDef.dungeonReturnTile.y;
  }

  const safeStart = options?.forceExactStartTile
    ? { x: safeStartTileX, y: safeStartTileY }
    : findNearestSpawnableTile(scene, map, scene.groundLayer, safeStartTileX, safeStartTileY);
  const safeTileX = safeStart.x;
  const safeTileY = safeStart.y;

  const startWorld = map.tileToWorldXY(
    safeTileX,
    safeTileY,
    undefined,
    undefined,
    scene.groundLayer
  );
  const startX = startWorld.x + map.tileWidth / 2;
  const startY = startWorld.y + map.tileHeight / 2;

  return { safeTileX, safeTileY, startX, startY };
}
