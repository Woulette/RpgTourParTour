import { monsterSpells } from "../../../content/spells/monsters/index.js";
import {
  castSpellAtTile,
  canCastSpell,
  canCastSpellOnTile,
} from "../spells/index.js";
import { showFloatingTextOverEntity } from "../runtime/floatingText.js";
import { isTileBlocked } from "../../../collision/collisionGrid.js";
import {
  delay,
  moveMonsterAlongPath,
  findPathToReachAdjacentToTarget,
  isTileOccupiedByMonster,
  getAliveCombatMonsters,
} from "../../../features/monsters/ai/aiUtils.js";

const POST_MOVE_DELAY_MS = 250;
const POST_ATTACK_DELAY_MS = 150;

function canCastFromTile(scene, monster, spell, tileX, tileY, targetX, targetY, map) {
  const prevX = monster.tileX;
  const prevY = monster.tileY;
  const prevCX = monster.currentTileX;
  const prevCY = monster.currentTileY;
  monster.tileX = tileX;
  monster.tileY = tileY;
  monster.currentTileX = tileX;
  monster.currentTileY = tileY;
  const ok = canCastSpellOnTile(scene, monster, spell, targetX, targetY, map);
  monster.tileX = prevX;
  monster.tileY = prevY;
  monster.currentTileX = prevCX;
  monster.currentTileY = prevCY;
  return ok;
}

function findPathToCast(scene, map, monster, targetX, targetY, spell, maxSteps) {
  if (!map || !spell) return null;
  const steps = Math.max(0, maxSteps | 0);

  const startX = monster.tileX;
  const startY = monster.tileY;
  if (
    typeof startX === "number" &&
    typeof startY === "number" &&
    canCastFromTile(scene, monster, spell, startX, startY, targetX, targetY, map)
  ) {
    return [];
  }

  if (steps <= 0) return null;

  const width = map.width;
  const height = map.height;
  const startKey = `${startX},${startY}`;
  const visited = new Set([startKey]);
  const queue = [{ x: startX, y: startY, path: [] }];
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const { x, y, path } = current;
    if (path.length >= steps) continue;

    for (const { dx, dy } of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (isTileBlocked(scene, nx, ny)) continue;
      if (isTileOccupiedByMonster(scene, nx, ny, monster)) continue;

      const nextPath = [...path, { x: nx, y: ny }];
      if (canCastFromTile(scene, monster, spell, nx, ny, targetX, targetY, map)) {
        return nextPath;
      }

      visited.add(key);
      queue.push({ x: nx, y: ny, path: nextPath });
    }
  }

  return null;
}

function moveAlong(scene, state, monster, map, groundLayer, path, cb) {
  if (!path || path.length === 0) {
    cb?.();
    return;
  }
  moveMonsterAlongPath(scene, monster, map, groundLayer, path, () => {
    state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - path.length);
    if (path.length > 0) {
      showFloatingTextOverEntity(scene, monster, `${path.length}`, {
        color: "#22c55e",
      });
    }
    delay(scene, POST_MOVE_DELAY_MS, cb);
  });
}

function hasAllyInRadius(scene, monster, radius = 2) {
  const allies = getAliveCombatMonsters(scene).filter(
    (m) => m && m !== monster
  );
  if (allies.length === 0) return false;

  const mx = monster.tileX ?? 0;
  const my = monster.tileY ?? 0;
  return allies.some((m) => {
    const tx = m.tileX ?? 0;
    const ty = m.tileY ?? 0;
    const dist = Math.abs(tx - mx) + Math.abs(ty - my);
    return dist <= radius;
  });
}

function findNearestEnemy(scene, monster) {
  const alive = getAliveCombatMonsters(scene);
  const mx = monster.tileX ?? 0;
  const my = monster.tileY ?? 0;
  let best = null;
  let bestDist = Infinity;
  for (const m of alive) {
    if (!m || !m.stats) continue;
    const hp = typeof m.stats.hp === "number" ? m.stats.hp : m.stats.hpMax ?? 0;
    if (hp <= 0) continue;
    const dx = Math.abs((m.tileX ?? 0) - mx);
    const dy = Math.abs((m.tileY ?? 0) - my);
    const d = dx + dy;
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}

function getEntityTile(entity, fallbackX = 0, fallbackY = 0) {
  const x =
    typeof entity?.currentTileX === "number"
      ? entity.currentTileX
      : typeof entity?.tileX === "number"
        ? entity.tileX
        : fallbackX;
  const y =
    typeof entity?.currentTileY === "number"
      ? entity.currentTileY
      : typeof entity?.tileY === "number"
        ? entity.tileY
        : fallbackY;
  return { x, y };
}

function hasAnyAllyInRadiusAtTile(monster, player, allies, tileX, tileY, radius) {
  const p = getEntityTile(player);
  const distP = Math.abs(p.x - tileX) + Math.abs(p.y - tileY);
  if (distP <= radius) return true;
  return allies.some((m) => {
    const t = getEntityTile(m);
    return Math.abs(t.x - tileX) + Math.abs(t.y - tileY) <= radius;
  });
}

function isTileFreeForMove(scene, map, player, monster, tileX, tileY) {
  if (!map) return false;
  if (tileX < 0 || tileY < 0 || tileX >= map.width || tileY >= map.height) return false;
  if (isTileBlocked(scene, tileX, tileY)) return false;
  if (isTileOccupiedByMonster(scene, tileX, tileY, monster)) return false;
  const p = getEntityTile(player);
  if (p.x === tileX && p.y === tileY) return false;
  return true;
}

function findPathToBuffAlly(scene, map, monster, player, allies, radius, maxSteps) {
  if (!map) return null;
  const steps = Math.max(0, maxSteps | 0);
  const startX = monster.tileX ?? 0;
  const startY = monster.tileY ?? 0;

  if (hasAnyAllyInRadiusAtTile(monster, player, allies, startX, startY, radius)) {
    return [];
  }

  if (steps <= 0) return null;

  const width = map.width;
  const height = map.height;
  const startKey = `${startX},${startY}`;
  const visited = new Set([startKey]);
  const queue = [{ x: startX, y: startY, path: [] }];
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const { x, y, path } = current;
    if (path.length >= steps) continue;

    for (const { dx, dy } of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (!isTileFreeForMove(scene, map, player, monster, nx, ny)) continue;

      const nextPath = [...path, { x: nx, y: ny }];
      if (hasAnyAllyInRadiusAtTile(monster, player, allies, nx, ny, radius)) {
        return nextPath;
      }

      visited.add(key);
      queue.push({ x: nx, y: ny, path: nextPath });
    }
  }

  return null;
}

export function runTurn(scene, state, monster, player, map, groundLayer, onComplete) {
  const finish = () => onComplete?.();
  const pmRestants = state.pmRestants ?? 0;
  const isAlly = monster.isCombatAlly === true;

  if (typeof monster.tileX !== "number" || typeof monster.tileY !== "number") {
    const t = map.worldToTileXY(monster.x, monster.y, true, undefined, undefined, groundLayer);
    if (t) {
      monster.tileX = t.x;
      monster.tileY = t.y;
      monster.currentTileX = t.x;
      monster.currentTileY = t.y;
    }
  }

  let mx = monster.tileX ?? 0;
  let my = monster.tileY ?? 0;

  const target = isAlly ? findNearestEnemy(scene, monster) : player;
  if (!target) {
    finish();
    return;
  }

  let px = target.currentTileX;
  let py = target.currentTileY;
  if (typeof px !== "number" || typeof py !== "number") {
    const t = map.worldToTileXY(target.x, target.y, true, undefined, undefined, groundLayer);
    if (t) {
      px = t.x;
      py = t.y;
    } else {
      finish();
      return;
    }
  }

  const spells = monsterSpells.maire_combat || {};
  const buff = spells.decret_maire;
  const hit = spells.jugement_maire;
  const allySummons = Array.isArray(scene?.combatSummons)
    ? scene.combatSummons.filter((s) => s && s.isCombatAlly && s !== monster)
    : [];
  const allies = isAlly
    ? allySummons
    : getAliveCombatMonsters(scene).filter((m) => m && m !== monster);

  const tryCast = (spell, tx, ty) => {
    if (!spell) return false;
    if (!canCastSpell(scene, monster, spell)) return false;
    if (!canCastSpellOnTile(scene, monster, spell, tx, ty, map)) return false;
    return castSpellAtTile(scene, monster, spell, tx, ty, map, groundLayer);
  };

  const maxActions = 6;
  let actions = 0;

  const canKeepActing = () => {
    if (actions >= maxActions) return false;
    const paNeed = hit?.paCost ?? 0;
    return (state.paRestants ?? 0) >= paNeed || (state.pmRestants ?? 0) > 0;
  };

  const pickEnemy = () => (isAlly ? findNearestEnemy(scene, monster) : player);

  const getTargetTile = (targetEntity) => {
    if (!targetEntity) return null;
    let tx = targetEntity.currentTileX;
    let ty = targetEntity.currentTileY;
    if (typeof tx !== "number" || typeof ty !== "number") {
      const t = map.worldToTileXY(
        targetEntity.x,
        targetEntity.y,
        true,
        undefined,
        undefined,
        groundLayer
      );
      if (!t) return null;
      tx = t.x;
      ty = t.y;
    }
    return { x: tx, y: ty };
  };

  const continueAfterAction = (delayMs = POST_ATTACK_DELAY_MS) => {
    actions += 1;
    if (!canKeepActing()) {
      delay(scene, delayMs, finish);
      return;
    }
    delay(scene, delayMs, attackCycle);
  };

  const attackCycle = () => {
    const targetEntity = pickEnemy();
    if (!targetEntity) {
      finish();
      return;
    }
    const t = getTargetTile(targetEntity);
    if (!t) {
      finish();
      return;
    }

    const tx = t.x;
    const ty = t.y;

    if (buff && canCastSpell(scene, monster, buff)) {
      if (hasAnyAllyInRadiusAtTile(monster, player, allies, mx, my, 2)) {
        if (tryCast(buff, mx, my)) {
          continueAfterAction();
          return;
        }
      } else if ((state.pmRestants ?? 0) > 0 && (player || allies.length > 0)) {
        const pathToBuff = findPathToBuffAlly(
          scene,
          map,
          monster,
          player,
          allies,
          2,
          state.pmRestants ?? 0
        );
        if (pathToBuff !== null) {
          moveAlong(scene, state, monster, map, groundLayer, pathToBuff, () => {
            mx = monster.tileX ?? mx;
            my = monster.tileY ?? my;
            if (hasAnyAllyInRadiusAtTile(monster, player, allies, mx, my, 2)) {
              tryCast(buff, mx, my);
            }
            continueAfterAction(POST_MOVE_DELAY_MS);
          });
          return;
        }
      }
    }

    if (hit && tryCast(hit, tx, ty)) {
      continueAfterAction();
      return;
    }

    if ((state.pmRestants ?? 0) > 0 && hit) {
      const pathToCast = findPathToCast(
        scene,
        map,
        monster,
        tx,
        ty,
        hit,
        state.pmRestants ?? 0
      );
      if (pathToCast !== null) {
        moveAlong(scene, state, monster, map, groundLayer, pathToCast, () => {
          continueAfterAction(POST_MOVE_DELAY_MS);
        });
        return;
      }

      const pathToMelee =
        findPathToReachAdjacentToTarget(scene, map, mx, my, tx, ty, 60, monster) || [];
      const pathTiles =
        pathToMelee.length > 0
          ? pathToMelee.slice(0, state.pmRestants ?? 0)
          : [];
      moveAlong(scene, state, monster, map, groundLayer, pathTiles, () => {
        continueAfterAction(POST_MOVE_DELAY_MS);
      });
      return;
    }

    delay(scene, 80, finish);
  };

  attackCycle();
}
