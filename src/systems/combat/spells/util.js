// Helpers "briques" utilisées par le spell system

// Distance en "cases" (Manhattan) pour la portée.
import { isTileBlocked } from "../../../collision/collisionGrid.js";

export function isTileInRange(spell, fromX, fromY, toX, toY) {
  const dx = Math.abs(toX - fromX);
  const dy = Math.abs(toY - fromY);
  const dist = dx + dy;

  const min = spell.rangeMin ?? 0;
  const max = spell.rangeMax ?? 0;

  return dist >= min && dist <= max;
}

// Une tuile est "disponible" si elle est dans la carte.
// Plus tard : layer de collision / obstacles / ligne de vue.
export function isTileAvailableForSpell(map, tileX, tileY) {
  if (!map) return false;
  if (tileX < 0 || tileX >= map.width) return false;
  if (tileY < 0 || tileY >= map.height) return false;
  return true;
}

export function getCasterOriginTile(caster) {
  const originX =
    typeof caster?.currentTileX === "number"
      ? caster.currentTileX
      : typeof caster?.tileX === "number"
      ? caster.tileX
      : 0;
  const originY =
    typeof caster?.currentTileY === "number"
      ? caster.currentTileY
      : typeof caster?.tileY === "number"
      ? caster.tileY
      : 0;
  return { x: originX, y: originY };
}

// Ligne de vue : bloquée par les tuiles en collision.
// Retourne true si aucun obstacle n'est présent entre les 2 tuiles (exclut origine et cible).
export function hasLineOfSight(scene, fromX, fromY, toX, toY) {
  if (!scene) return true;
  if (
    typeof fromX !== "number" ||
    typeof fromY !== "number" ||
    typeof toX !== "number" ||
    typeof toY !== "number"
  ) {
    return true;
  }

  if (fromX === toX && fromY === toY) return true;

  const dx = Math.abs(toX - fromX);
  const dy = Math.abs(toY - fromY);
  const sx = fromX < toX ? 1 : -1;
  const sy = fromY < toY ? 1 : -1;
  let err = dx - dy;

  let x = fromX;
  let y = fromY;

  while (!(x === toX && y === toY)) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }

    if (x === toX && y === toY) break;
    if (isTileBlocked(scene, x, y)) return false;
  }

  return true;
}
