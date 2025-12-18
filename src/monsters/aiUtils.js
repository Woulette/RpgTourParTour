import { PLAYER_SPEED } from "../config/constants.js";
import { isTileBlocked } from "../collision/collisionGrid.js";

export function delay(scene, ms, fn) {
  const duration = Math.max(0, ms | 0);
  if (duration <= 0) {
    if (typeof fn === "function") fn();
    return null;
  }
  if (scene && scene.time && typeof scene.time.delayedCall === "function") {
    return scene.time.delayedCall(duration, () => {
      if (typeof fn === "function") fn();
    });
  }
  if (typeof fn === "function") fn();
  return null;
}

// Déplacement fluide case par case en chaînant les tweens.
export function moveMonsterAlongPath(
  scene,
  monster,
  map,
  groundLayer,
  path,
  onDone
) {
  const queue = Array.isArray(path) ? path.slice() : [];

  if (queue.length === 0) {
    if (typeof onDone === "function") onDone();
    return;
  }

  const stepNext = () => {
    if (queue.length === 0) {
      if (typeof onDone === "function") onDone();
      return;
    }

    const next = queue.shift();
    const worldPos = map.tileToWorldXY(
      next.x,
      next.y,
      undefined,
      undefined,
      groundLayer
    );
    const offX =
      typeof monster.renderOffsetX === "number" ? monster.renderOffsetX : 0;
    const offY =
      typeof monster.renderOffsetY === "number" ? monster.renderOffsetY : 0;
    const targetX = worldPos.x + map.tileWidth / 2 + offX;
    const targetY = worldPos.y + map.tileHeight + offY;

    const dist = Phaser.Math.Distance.Between(
      monster.x,
      monster.y,
      targetX,
      targetY
    );
    const duration = (dist / PLAYER_SPEED) * 1000;

    scene.tweens.add({
      targets: monster,
      x: targetX,
      y: targetY,
      duration,
      ease: "Linear",
      onComplete: () => {
        monster.x = targetX;
        monster.y = targetY;
        monster.tileX = next.x;
        monster.tileY = next.y;
        stepNext();
      },
    });
  };

  stepNext();
}

// Retourne tous les monstres de combat encore en vie.
export function getAliveCombatMonsters(scene) {
  const list =
    (scene.combatMonsters && Array.isArray(scene.combatMonsters)
      ? scene.combatMonsters
      : scene.monsters || []);

  return list.filter((m) => {
    if (!m || !m.stats) return false;
    const hp =
      typeof m.stats.hp === "number" ? m.stats.hp : m.stats.hpMax ?? 0;
    return hp > 0;
  });
}

// True si une tuile est occupée par un autre monstre vivant.
export function isTileOccupiedByMonster(scene, tileX, tileY, self) {
  const alive = getAliveCombatMonsters(scene);
  return alive.some((m) => {
    if (!m) return false;
    if (self && m === self) return false;
    return m.tileX === tileX && m.tileY === tileY;
  });
}

// Choisit la meilleure case voisine pour se rapprocher ou fuir une cible,
// en partant d'une position donnée, en évitant les cases hors carte
// et les alliés. Retourne { x, y } ou null si aucune case valide.
export function chooseStepTowardsTarget(
  scene,
  map,
  monster,
  fromX,
  fromY,
  targetX,
  targetY,
  fleeing
) {
  const mx = fromX;
  const my = fromY;

  const dx = targetX - mx;
  const dy = targetY - my;
  const currentDist = Math.abs(dx) + Math.abs(dy);

  const dirX = dx === 0 ? 0 : Math.sign(dx);
  const dirY = dy === 0 ? 0 : Math.sign(dy);

  const candidates = [];

  if (!fleeing) {
    // On veut se rapprocher
    if (dirX !== 0) candidates.push({ sx: dirX, sy: 0 });
    if (dirY !== 0) candidates.push({ sx: 0, sy: dirY });
    // Essais secondaires (permettre un léger contournement)
    if (dirX !== 0) candidates.push({ sx: -dirX, sy: 0 });
    if (dirY !== 0) candidates.push({ sx: 0, sy: -dirY });
  } else {
    // Fuite : on s'éloigne
    if (dirX !== 0) candidates.push({ sx: -dirX, sy: 0 });
    if (dirY !== 0) candidates.push({ sx: 0, sy: -dirY });
    if (dirX !== 0) candidates.push({ sx: dirX, sy: 0 });
    if (dirY !== 0) candidates.push({ sx: 0, sy: dirY });
  }

  let best = null;
  let bestDist = fleeing ? -Infinity : Infinity;

  for (const { sx, sy } of candidates) {
    if (sx === 0 && sy === 0) continue;

    const nx = mx + sx;
    const ny = my + sy;

    // Hors de la carte
    if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;

    // Case bloquante : collision ou allié
    if (isTileBlocked(scene, nx, ny)) continue;
    if (isTileOccupiedByMonster(scene, nx, ny, monster)) continue;

    const d = Math.abs(targetX - nx) + Math.abs(targetY - ny);

    if (!fleeing) {
      // On cherche une case qui ne nous éloigne pas plus qu'avant,
      // et qui rapproche le plus (distance minimale).
      if (d > currentDist) continue;
      if (d < bestDist) {
        bestDist = d;
        best = { x: nx, y: ny };
      }
    } else {
      // En fuite : on cherche à s'éloigner (distance maximale)
      if (d > bestDist) {
        bestDist = d;
        best = { x: nx, y: ny };
      }
    }
  }

  return best;
}

// Pathfinding gǸnǸrique (BFS) : cherche un chemin en 4 directions
// depuis (fromX, fromY) vers une case adjacente �� la cible (targetX, targetY),
// en Ǹvitant les cases hors carte et celles occupǸes par d'autres monstres.
// Renvoie un tableau [{ x, y }, ...] reprǸsentant le chemin complet,
// ou null si aucune case de contact n'est atteignable.
export function findPathToReachAdjacentToTarget(
  scene,
  map,
  fromX,
  fromY,
  targetX,
  targetY,
  maxSteps,
  self
) {
  if (!map) return null;

  const width = map.width;
  const height = map.height;

  const maxDepth =
    typeof maxSteps === "number" && maxSteps > 0
      ? maxSteps
      : width + height + 10;

  const startKey = `${fromX},${fromY}`;
  const visited = new Set([startKey]);

  const queue = [
    {
      x: fromX,
      y: fromY,
      path: [],
    },
  ];

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  const isGoal = (x, y) => {
    const dist = Math.abs(x - targetX) + Math.abs(y - targetY);
    return dist === 1;
  };

  while (queue.length > 0) {
    const current = queue.shift();
    const { x, y, path } = current;

    if (path.length > maxDepth) {
      continue;
    }

    // On consid��re qu'on a trouvǸ une bonne case de contact
    // uniquement si on a effectuǸ au moins un pas
    if (path.length > 0 && isGoal(x, y)) {
      return path;
    }

    for (const { dx, dy } of dirs) {
      const nx = x + dx;
      const ny = y + dy;

      // Hors carte
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;

      // Case occupǸe par un autre monstre : on ne peut pas marcher dessus
      if (isTileBlocked(scene, nx, ny)) continue;
      if (isTileOccupiedByMonster(scene, nx, ny, self)) continue;

      visited.add(key);

      queue.push({
        x: nx,
        y: ny,
        path: [...path, { x: nx, y: ny }],
      });
    }
  }

  // Aucun chemin trouvǸ pour atteindre une case adjacente
  return null;
}
