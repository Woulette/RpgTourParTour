// Helpers "briques" utilisees par le spell system

// Distance en "cases" (Manhattan) pour la portee.
import { isTileBlocked } from "../../../collision/collisionGrid.js";
import { getAliveCombatMonsters } from "../../../features/monsters/ai/aiUtils.js";

function getAliveCombatSummons(scene) {
  const list =
    scene?.combatSummons && Array.isArray(scene.combatSummons)
      ? scene.combatSummons
      : [];
  return list.filter((s) => {
    if (!s || !s.stats) return false;
    const hp = typeof s.stats.hp === "number" ? s.stats.hp : s.stats.hpMax ?? 0;
    return hp > 0;
  });
}

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

// Une tuile est ciblable si elle est dans la carte ET n'est pas une tuile de collision.
export function isTileTargetableForSpell(scene, map, tileX, tileY) {
  if (!isTileAvailableForSpell(map, tileX, tileY)) return false;
  if (scene && isTileBlocked(scene, tileX, tileY)) return false;
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

function isTileOccupiedByCombatEntity(scene, tileX, tileY) {
  const state = scene?.combatState;
  if (state?.joueur) {
    const p = getCasterOriginTile(state.joueur);
    if (p.x === tileX && p.y === tileY) return true;
  }

  const monsters = getAliveCombatMonsters(scene);
  const occupiedByMonster = monsters.some(
    (m) =>
      m &&
      typeof m.tileX === "number" &&
      typeof m.tileY === "number" &&
      m.tileX === tileX &&
      m.tileY === tileY
  );
  if (occupiedByMonster) return true;

  const summons = getAliveCombatSummons(scene);
  return summons.some(
    (s) =>
      s &&
      typeof s.tileX === "number" &&
      typeof s.tileY === "number" &&
      s.tileX === tileX &&
      s.tileY === tileY
  );
}

// Ligne de vue : bloquee par les tuiles en collision et par les entites (joueur/monstres).
// Retourne true si aucun obstacle n'est present entre les 2 tuiles (exclut origine et cible).
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
    if (isTileOccupiedByCombatEntity(scene, x, y)) return false;
  }

  return true;
}
