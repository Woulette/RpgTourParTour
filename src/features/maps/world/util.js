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
  return function worldToTile(worldX, worldY) {
    const raw = groundLayer.worldToTileXY(worldX, worldY, false);
    if (!raw) return null;

    const fx = Math.floor(raw.x);
    const fy = Math.floor(raw.y);
    const cx = Math.ceil(raw.x);
    const cy = Math.ceil(raw.y);

    const candidates = [
      { x: fx, y: fy },
      { x: fx, y: cy },
      { x: cx, y: fy },
      { x: cx, y: cy },
    ];

    const width = map.width;
    const height = map.height;
    const halfW = map.tileWidth / 2;
    const halfH = map.tileHeight / 2;

    let best = null;
    let bestDist = Infinity;

    for (const c of candidates) {
      if (c.x < 0 || c.y < 0 || c.x >= width || c.y >= height) continue;
      const wp = map.tileToWorldXY(
        c.x,
        c.y,
        undefined,
        undefined,
        groundLayer
      );
      const centerX = wp.x + halfW;
      const centerY = wp.y + halfH;
      const dx = worldX - centerX;
      const dy = worldY - centerY;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < bestDist) {
        bestDist = dist2;
        best = c;
      }
    }

    return best;
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
