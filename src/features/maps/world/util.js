import { maps } from "../index.js";

// Index des maps par coordonnÈes logiques (x, y).
// ClÈ: "x,y" -> valeur = dÈfinition de map.
const mapsByCoord = new Map();

Object.values(maps).forEach((mapDef) => {
  const pos = mapDef.worldPos;
  if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") return;
  const key = `${pos.x},${pos.y}`;
  if (!mapsByCoord.has(key)) {
    mapsByCoord.set(key, mapDef);
  }
});

export function getMapAt(x, y) {
  return mapsByCoord.get(`${x},${y}`) || null;
}

export function getNeighbor(mapDef, direction) {
  if (!mapDef || !mapDef.worldPos) return null;

  const { x, y } = mapDef.worldPos;
  let nx = x;
  let ny = y;

  switch (direction) {
    case "right":
      nx = x + 1;
      break;
    case "left":
      nx = x - 1;
      break;
    case "up":
      ny = y - 1;
      break;
    case "down":
      ny = y + 1;
      break;
    default:
      return null;
  }

  return getMapAt(nx, ny);
}

// Conversion monde->tuiles "calibrÈe" pour l'isomÈtrique.
// DupliquÈe depuis playerMovement pour rester locale au module de monde.
export function createCalibratedWorldToTile(map, groundLayer) {
  const testTileX = 0;
  const testTileY = 0;

  const worldPos = map.tileToWorldXY(
    testTileX,
    testTileY,
    undefined,
    undefined,
    groundLayer
  );
  const centerX = worldPos.x + map.tileWidth / 2;
  const centerY = worldPos.y + map.tileHeight / 2;

  const tF = groundLayer.worldToTileXY(centerX, centerY, false);

  let offsetX = 0;
  let offsetY = 0;
  if (tF) {
    offsetX = tF.x - testTileX - 0.5;
    offsetY = tF.y - testTileY - 0.5;
  }

  return function worldToTile(worldX, worldY) {
    const raw = groundLayer.worldToTileXY(worldX, worldY, false);
    if (!raw) return null;

    return {
      x: Math.floor(raw.x - offsetX),
      y: Math.floor(raw.y - offsetY),
    };
  };
}

// Calcule, pour la map isomÈtrique actuelle, les vecteurs de dÈplacement
// "Ècran" (haut/bas/gauche/droite) exprimÈs en delta de tuiles.
export function computeScreenDirectionVectors(map, groundLayer) {
  const worldToTile = createCalibratedWorldToTile(map, groundLayer);

  const centerTileX = Math.floor(map.width / 2);
  const centerTileY = Math.floor(map.height / 2);
  const centerWorld = map.tileToWorldXY(
    centerTileX,
    centerTileY,
    undefined,
    undefined,
    groundLayer
  );

  const baseX = centerWorld.x + map.tileWidth / 2;
  const baseY = centerWorld.y + map.tileHeight / 2;

  const stepX = map.tileWidth;
  const stepY = map.tileHeight;

  const tileCenter = worldToTile(baseX, baseY);
  const upTile = worldToTile(baseX, baseY - stepY);
  const downTile = worldToTile(baseX, baseY + stepY);
  const leftTile = worldToTile(baseX - stepX, baseY);
  const rightTile = worldToTile(baseX + stepX, baseY);

  function diff(a, b) {
    if (!a || !b) return { dx: 0, dy: 0 };
    return { dx: a.x - b.x, dy: a.y - b.y };
  }

  return {
    up: diff(upTile, tileCenter),
    down: diff(downTile, tileCenter),
    left: diff(leftTile, tileCenter),
    right: diff(rightTile, tileCenter),
  };
}
