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

function pickEntryTile(scene, map, options) {
  if (!scene || !map) return null;
  const entryDir = options?.entryDirection;
  if (!entryDir) return null;
  const opposite = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  }[entryDir];
  const exits = Array.isArray(scene.worldExits?.[opposite])
    ? scene.worldExits[opposite]
    : [];
  if (exits.length === 0) return null;

  const from = options?.entryFromTile;
  const fromWorld = options?.entryFromWorld;
  const hasFromX = Number.isInteger(from?.x);
  const hasFromY = Number.isInteger(from?.y);
  const hasFromWorldX = Number.isFinite(fromWorld?.x);
  const hasFromWorldY = Number.isFinite(fromWorld?.y);
  const matchX = opposite === "up" || opposite === "down";
  const groundLayer = scene.groundLayer;

  let best = null;
  let bestScore = Infinity;
  const centerX = Math.floor(map.width / 2);
  const centerY = Math.floor(map.height / 2);

  exits.forEach((tile) => {
    if (!tile || typeof tile.x !== "number" || typeof tile.y !== "number") return;
    let score = Infinity;
    if (
      (matchX && hasFromWorldX) ||
      (!matchX && hasFromWorldY)
    ) {
      const wp = map.tileToWorldXY(
        tile.x,
        tile.y,
        undefined,
        undefined,
        groundLayer
      );
      if (wp && Number.isFinite(wp.x) && Number.isFinite(wp.y)) {
        const centerWx = wp.x + map.tileWidth / 2;
        const centerWy = wp.y + map.tileHeight / 2;
        score = matchX
          ? Math.abs(centerWx - fromWorld.x)
          : Math.abs(centerWy - fromWorld.y);
      }
    } else if (matchX && hasFromX) {
      score = Math.abs(tile.x - from.x);
    } else if (!matchX && hasFromY) {
      score = Math.abs(tile.y - from.y);
    } else {
      const dx = tile.x - centerX;
      const dy = tile.y - centerY;
      score = dx * dx + dy * dy;
    }
    if (score < bestScore) {
      bestScore = score;
      best = tile;
    }
  });

  return best ? { x: best.x, y: best.y } : null;
}

export function computeStartPosition(scene, map, mapDef, options = {}) {
  const entryTile = pickEntryTile(scene, map, options);
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
    entryTile ||
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
