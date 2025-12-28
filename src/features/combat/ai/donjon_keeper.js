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

  const target = monster.isCombatAlly ? findNearestEnemy(scene, monster) : player;
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

  const spells = monsterSpells.donjon_keeper || {};
  const pull = spells.traction_gardien;
  const hit = spells.gardatagarde;

  const tryCast = (spell) => {
    if (!spell) return false;
    if (!canCastSpell(scene, monster, spell)) return false;
    if (!canCastSpellOnTile(scene, monster, spell, px, py, map)) return false;
    return castSpellAtTile(scene, monster, spell, px, py, map, groundLayer);
  };

  const tryHitTwice = () => {
    let casted = false;
    if (tryCast(hit)) {
      casted = true;
      px = player.currentTileX;
      py = player.currentTileY;
    }
    if (tryCast(hit)) {
      casted = true;
    }
    delay(scene, casted ? POST_ATTACK_DELAY_MS : 80, finish);
  };

  const dist = Math.abs(px - mx) + Math.abs(py - my);

  // If target is far, try to line up and pull, then hit once if possible.
  if (dist >= 5 && pull) {
    const attemptPull = () => {
      const pulled = tryCast(pull);
      if (!pulled) {
        delay(scene, 80, finish);
        return;
      }
      px = player.currentTileX;
      py = player.currentTileY;
      delay(scene, POST_ATTACK_DELAY_MS, () => {
        tryCast(hit);
        delay(scene, POST_ATTACK_DELAY_MS, finish);
      });
    };

    if (canCastSpell(scene, monster, pull)) {
      const pathToCast = findPathToCast(
        scene,
        map,
        monster,
        px,
        py,
        pull,
        pmRestants
      );
      if (pathToCast !== null) {
        moveAlong(scene, state, monster, map, groundLayer, pathToCast, attemptPull);
        return;
      }
    }
  }

  // Otherwise, go to melee if possible and hit twice.
  if (pmRestants > 0) {
    const path =
      findPathToReachAdjacentToTarget(scene, map, mx, my, px, py, 60, monster) || [];
    const pathTiles = path.length > 0 ? path.slice(0, pmRestants) : [];
    moveAlong(scene, state, monster, map, groundLayer, pathTiles, tryHitTwice);
    return;
  }

  tryHitTwice();
}
