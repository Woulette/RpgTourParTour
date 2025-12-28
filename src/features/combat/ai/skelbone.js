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
  chooseStepTowardsTarget,
  isTileOccupiedByMonster,
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

function findPathToCastRanged(scene, map, monster, targetX, targetY, spell, maxSteps) {
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

function buildFleePath(scene, map, monster, fromX, fromY, targetX, targetY, maxSteps) {
  const steps = Math.max(0, maxSteps | 0);
  if (steps <= 0) return [];
  const path = [];
  let cx = fromX;
  let cy = fromY;
  for (let i = 0; i < steps; i += 1) {
    const step = chooseStepTowardsTarget(
      scene,
      map,
      monster,
      cx,
      cy,
      targetX,
      targetY,
      true
    );
    if (!step) break;
    path.push(step);
    cx = step.x;
    cy = step.y;
  }
  return path;
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

export function runTurn(scene, state, monster, player, map, groundLayer, onComplete) {
  const finish = () => onComplete?.();
  const pmRestants = state.pmRestants ?? 0;

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

  let px = player.currentTileX;
  let py = player.currentTileY;
  if (typeof px !== "number" || typeof py !== "number") {
    const t = map.worldToTileXY(player.x, player.y, true, undefined, undefined, groundLayer);
    if (t) {
      px = t.x;
      py = t.y;
    } else {
      finish();
      return;
    }
  }

  const spells = monsterSpells.skelbone || {};
  const ranged = spells.maintendu;

  const tryCast = () => {
    if (!ranged) return false;
    if (!canCastSpell(scene, monster, ranged)) return false;
    if (!canCastSpellOnTile(scene, monster, ranged, px, py, map)) return false;
    return castSpellAtTile(scene, monster, ranged, px, py, map, groundLayer);
  };

  const tryFlee = () => {
    const fleePath = buildFleePath(scene, map, monster, mx, my, px, py, state.pmRestants ?? 0);
    moveAlong(scene, state, monster, map, groundLayer, fleePath, () =>
      delay(scene, POST_MOVE_DELAY_MS, finish)
    );
  };

  if (ranged && canCastSpell(scene, monster, ranged)) {
    const pathToCast = findPathToCastRanged(
      scene,
      map,
      monster,
      px,
      py,
      ranged,
      pmRestants
    );

    if (pathToCast !== null) {
      moveAlong(scene, state, monster, map, groundLayer, pathToCast, () => {
        mx = monster.tileX ?? mx;
        my = monster.tileY ?? my;

        const didCast = tryCast();
        if (!didCast) {
          delay(scene, POST_ATTACK_DELAY_MS, finish);
          return;
        }

        delay(scene, POST_ATTACK_DELAY_MS, tryFlee);
      });
      return;
    }
  }

  if (pmRestants <= 0) {
    finish();
    return;
  }

  const path = [];
  let cx = mx;
  let cy = my;
  for (let i = 0; i < pmRestants; i += 1) {
    const step = chooseStepTowardsTarget(scene, map, monster, cx, cy, px, py, false);
    if (!step) break;
    path.push(step);
    cx = step.x;
    cy = step.y;
  }

  moveAlong(scene, state, monster, map, groundLayer, path, () =>
    delay(scene, POST_MOVE_DELAY_MS, finish)
  );
}
