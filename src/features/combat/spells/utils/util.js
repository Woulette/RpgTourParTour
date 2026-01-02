// Helpers "briques" utilisees par le spell system

// Distance en "cases" (Manhattan) pour la portee.
import { isTileBlocked } from "../../../../collision/collisionGrid.js";
import { getAliveCombatMonsters } from "../../../../features/monsters/ai/aiUtils.js";
import { getAliveCombatAllies } from "../../summons/summon.js";

function getAliveCombatSummons(scene) {
  const list =
    scene?.combatSummons && Array.isArray(scene.combatSummons)
      ? scene.combatSummons
      : [];
  return list.filter((s) => {
    if (!s || !s.stats) return false;
    if (s.isCombatAlly) return false;
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
  const occupiedByMonster = monsters.some((m) => {
    if (!m) return false;
    const mx =
      typeof m.currentTileX === "number"
        ? m.currentTileX
        : typeof m.tileX === "number"
        ? m.tileX
        : null;
    const my =
      typeof m.currentTileY === "number"
        ? m.currentTileY
        : typeof m.tileY === "number"
        ? m.tileY
        : null;
    return mx === tileX && my === tileY;
  });
  if (occupiedByMonster) return true;

  const summons = getAliveCombatSummons(scene);
  if (
    summons.some(
      (s) => {
        if (!s) return false;
        const sx =
          typeof s.currentTileX === "number"
            ? s.currentTileX
            : typeof s.tileX === "number"
            ? s.tileX
            : null;
        const sy =
          typeof s.currentTileY === "number"
            ? s.currentTileY
            : typeof s.tileY === "number"
            ? s.tileY
            : null;
        return sx === tileX && sy === tileY;
      }
    )
  ) {
    return true;
  }

  const allies = getAliveCombatAllies(scene);
  return allies.some(
    (s) => {
      if (!s) return false;
      const sx =
        typeof s.currentTileX === "number"
          ? s.currentTileX
          : typeof s.tileX === "number"
          ? s.tileX
          : null;
      const sy =
        typeof s.currentTileY === "number"
          ? s.currentTileY
          : typeof s.tileY === "number"
          ? s.tileY
          : null;
      return sx === tileX && sy === tileY;
    }
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

  const startX = fromX + 0.5;
  const startY = fromY + 0.5;
  const endX = toX + 0.5;
  const endY = toY + 0.5;
  const dirX = endX - startX;
  const dirY = endY - startY;
  const stepX = dirX === 0 ? 0 : dirX > 0 ? 1 : -1;
  const stepY = dirY === 0 ? 0 : dirY > 0 ? 1 : -1;
  const tDeltaX = stepX === 0 ? Infinity : Math.abs(1 / dirX);
  const tDeltaY = stepY === 0 ? Infinity : Math.abs(1 / dirY);

  let x = fromX;
  let y = fromY;
  const nextBoundaryX = stepX > 0 ? Math.floor(startX) + 1 : Math.floor(startX);
  const nextBoundaryY = stepY > 0 ? Math.floor(startY) + 1 : Math.floor(startY);
  let tMaxX =
    stepX === 0 ? Infinity : Math.abs((nextBoundaryX - startX) / dirX);
  let tMaxY =
    stepY === 0 ? Infinity : Math.abs((nextBoundaryY - startY) / dirY);

  const isBlocking = (tx, ty) => {
    if (tx === fromX && ty === fromY) return false;
    if (tx === toX && ty === toY) return false;
    if (isTileBlocked(scene, tx, ty)) return "tile";
    if (isTileOccupiedByCombatEntity(scene, tx, ty)) return "entity";
    return false;
  };

  while (!(x === toX && y === toY)) {
    if (tMaxX < tMaxY) {
      x += stepX;
      tMaxX += tDeltaX;
    } else if (tMaxY < tMaxX) {
      y += stepY;
      tMaxY += tDeltaY;
    } else {
      x += stepX;
      y += stepY;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
    }

    if (x === toX && y === toY) break;

    const blockHere = isBlocking(x, y);
    if (blockHere) return false;
  }

  return true;
}
