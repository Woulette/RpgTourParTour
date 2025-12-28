import { monsterSpells } from "../../../content/spells/monsters/index.js";
import {
  castSpellAtTile,
  canCastSpellOnTile,
  isSpellInRangeFromPosition,
} from "../spells/index.js";
import { hasLineOfSight } from "../spells/util.js";
import { showFloatingTextOverEntity } from "../runtime/floatingText.js";
import {
  moveMonsterAlongPath,
  isTileOccupiedByMonster,
  chooseStepTowardsTarget,
  getAliveCombatMonsters,
  delay,
} from "../../../features/monsters/ai/aiUtils.js";
import { isTileBlocked } from "../../../collision/collisionGrid.js";

const POST_MOVE_DELAY_MS = 250;
const POST_ATTACK_DELAY_MS = 150;

function findPathToTile(scene, map, fromX, fromY, toX, toY, maxNodes = 120, self) {
  if (!map) return null;
  const width = map.width;
  const height = map.height;

  const key = (x, y) => `${x},${y}`;
  const startKey = key(fromX, fromY);
  const targetKey = key(toX, toY);

  const queue = [{ x: fromX, y: fromY }];
  const visited = new Set([startKey]);
  const parent = new Map();

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  let nodes = 0;
  while (queue.length > 0 && nodes < maxNodes) {
    const cur = queue.shift();
    nodes += 1;

    const curKey = key(cur.x, cur.y);
    if (curKey === targetKey) {
      const path = [];
      let k = curKey;
      let p = cur;
      while (p && k !== startKey) {
        path.unshift({ x: p.x, y: p.y });
        const prev = parent.get(k);
        if (!prev) break;
        p = prev.node;
        k = prev.key;
      }
      return path;
    }

    for (const d of dirs) {
      const nx = cur.x + d.dx;
      const ny = cur.y + d.dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const k = key(nx, ny);
      if (visited.has(k)) continue;
      if (isTileBlocked(scene, nx, ny)) continue;
      if (isTileOccupiedByMonster(scene, nx, ny, self)) continue;
      visited.add(k);
      parent.set(k, { node: cur, key: curKey });
      queue.push({ x: nx, y: ny });
    }
  }

  return null;
}

// IA du Liburion : lanceur en ligne (2-4 PO), puis fuite après attaque.
export function runTurn(scene, state, monster, player, map, groundLayer, onComplete) {
  if (typeof monster.tileX !== "number" || typeof monster.tileY !== "number") {
    const t = map.worldToTileXY(monster.x, monster.y, true, undefined, undefined, groundLayer);
    if (t) {
      monster.tileX = t.x;
      monster.tileY = t.y;
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
      onComplete?.();
      return;
    }
  }

  const libuSpells = monsterSpells.liburion || {};
  const eclat = libuSpells.eclat;
  const rugissement = libuSpells.rugissement;

  const getMonsterTile = () => ({
    x: typeof monster.tileX === "number" ? monster.tileX : mx,
    y: typeof monster.tileY === "number" ? monster.tileY : my,
  });

  const hasLosToPlayer = (tx, ty) =>
    typeof tx === "number" &&
    typeof ty === "number" &&
    hasLineOfSight(scene, tx, ty, px, py);

  const countAlliesInRadius = (cx, cy, radius) => {
    const list = getAliveCombatMonsters(scene);
    let count = 0;
    for (const m of list) {
      if (!m || m === monster) continue;
      if (typeof m.tileX !== "number" || typeof m.tileY !== "number") continue;
      const d = Math.abs(m.tileX - cx) + Math.abs(m.tileY - cy);
      if (d <= radius) count += 1;
    }
    return count;
  };

  const buildReachableTiles = (startX, startY, maxSteps) => {
    const results = [];
    const queue = [{ x: startX, y: startY, path: [] }];
    const visited = new Set([`${startX},${startY}`]);

    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    while (queue.length > 0) {
      const cur = queue.shift();
      results.push(cur);
      if (cur.path.length >= maxSteps) continue;

      for (const dir of dirs) {
        const nx = cur.x + dir.dx;
        const ny = cur.y + dir.dy;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        if (isTileBlocked(scene, nx, ny)) continue;
        if (isTileOccupiedByMonster(scene, nx, ny, monster)) continue;
        visited.add(key);
        queue.push({ x: nx, y: ny, path: [...cur.path, { x: nx, y: ny }] });
      }
    }

    return results;
  };

  const isInRange = (tx, ty) => {
    if (!eclat) return false;
    return isSpellInRangeFromPosition(eclat, tx, ty, px, py);
  };

  const tryCastEclat = () => {
    if (!eclat) return false;
    const st = scene.combatState;
    if (!st || !st.enCours) return false;
    const pos = getMonsterTile();
    if (!hasLosToPlayer(pos.x, pos.y)) return false;
    if (!canCastSpellOnTile(scene, monster, eclat, px, py, map)) return false;
    return castSpellAtTile(scene, monster, eclat, px, py, map, groundLayer);
  };

  const tryCastRugissement = () => {
    if (!rugissement) return false;
    const st = scene.combatState;
    if (!st || !st.enCours) return false;
    const pos = getMonsterTile();
    if (!canCastSpellOnTile(scene, monster, rugissement, pos.x, pos.y, map)) return false;
    return castSpellAtTile(scene, monster, rugissement, pos.x, pos.y, map, groundLayer);
  };

  let didAttackThisTurn = false;

  const fleeAfterAttack = () => {
    if (!didAttackThisTurn) {
      onComplete?.();
      return;
    }

    delay(scene, POST_ATTACK_DELAY_MS, () => {
      const pm = state.pmRestants ?? 0;
      if (pm <= 0) {
        onComplete?.();
        return;
      }

      let cx = monster.tileX ?? mx;
      let cy = monster.tileY ?? my;
      const pathTiles = [];

      for (let i = 0; i < pm; i += 1) {
        const next = chooseStepTowardsTarget(scene, map, monster, cx, cy, px, py, true);
        if (!next) break;
        cx = next.x;
        cy = next.y;
        pathTiles.push({ x: cx, y: cy });
      }

      if (pathTiles.length === 0) {
        onComplete?.();
        return;
      }

      moveMonsterAlongPath(scene, monster, map, groundLayer, pathTiles, () => {
        state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - pathTiles.length);
          if (pathTiles.length > 0) {
            showFloatingTextOverEntity(scene, monster, `${pathTiles.length}`, {
              color: "#22c55e",
            });
          }
        delay(scene, POST_MOVE_DELAY_MS, () => onComplete?.());
      });
    });
  };

  const castSequenceEclat = (count) => {
    if (!scene.combatState?.enCours) {
      onComplete?.();
      return;
    }
    if (count <= 0) {
      fleeAfterAttack();
      return;
    }
    if (!eclat || !canCastSpellOnTile(scene, monster, eclat, px, py, map)) {
      fleeAfterAttack();
      return;
    }
    const ok = tryCastEclat();
    if (!ok) {
      fleeAfterAttack();
      return;
    }
    didAttackThisTurn = true;
    if (scene.time?.delayedCall) {
      scene.time.delayedCall(POST_ATTACK_DELAY_MS, () => castSequenceEclat(count - 1));
    }
    else castSequenceEclat(count - 1);
  };

  const inLine = (tx, ty) => tx === px || ty === py;
  const distToPlayer = (tx, ty) => Math.abs(px - tx) + Math.abs(py - ty);
  const inCastWindow = (tx, ty) => {
    if (!eclat) return false;
    if (!inLine(tx, ty)) return false;
    if (!hasLosToPlayer(tx, ty)) return false;
    const d = distToPlayer(tx, ty);
    const min = eclat.rangeMin ?? 0;
    const max = eclat.rangeMax ?? 0;
    return d >= min && d <= max;
  };

  const candidates = [];
  for (let d = 2; d <= 4; d += 1) {
    candidates.push({ x: px + d, y: py });
    candidates.push({ x: px - d, y: py });
    candidates.push({ x: px, y: py + d });
    candidates.push({ x: px, y: py - d });
  }

  const isFree = (x, y) => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    if (isTileBlocked(scene, x, y)) return false;
    if (isTileOccupiedByMonster(scene, x, y, monster)) return false;
    return true;
  };

  let bestPath = null;
  let bestScore = Infinity;

  candidates.forEach((c) => {
    if (!isFree(c.x, c.y)) return;
    if (!inCastWindow(c.x, c.y)) return;
    const path = findPathToTile(scene, map, mx, my, c.x, c.y, 160, monster);
    if (!path) return;
    const score = path.length * 10 + Math.abs(distToPlayer(c.x, c.y) - 3);
    if (score < bestScore) {
      bestScore = score;
      bestPath = path;
    }
  });

  if (!bestPath) {
    const scan = [];
    for (let r = 1; r <= 6; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          scan.push({ x: mx + dx, y: my + dy });
        }
      }
    }

    scan.forEach((c) => {
      if (!isFree(c.x, c.y)) return;
      const path = findPathToTile(scene, map, mx, my, c.x, c.y, 160, monster);
      if (!path) return;
      const d = distToPlayer(c.x, c.y);
      const alignedPenalty = inLine(c.x, c.y) ? 0 : 30;
      const rangePenalty = eclat
        ? Math.min(Math.abs(d - (eclat.rangeMin ?? 0)), Math.abs(d - (eclat.rangeMax ?? 0))) * 6
        : Math.abs(d - 3) * 6;
      const score = path.length * 10 + alignedPenalty + rangePenalty;
      if (score < bestScore) {
        bestScore = score;
        bestPath = path;
      }
    });
  }

  const runOffense = () => {
    if (eclat && canCastSpellOnTile(scene, monster, eclat, px, py, map)) {
      delay(scene, POST_ATTACK_DELAY_MS, () => castSequenceEclat(2));
      return;
    }

    const availablePm = state.pmRestants ?? 0;
    const pathTiles = bestPath && availablePm > 0 ? bestPath.slice(0, availablePm) : [];
    if (pathTiles.length === 0) {
      onComplete?.();
      return;
    }

    moveMonsterAlongPath(scene, monster, map, groundLayer, pathTiles, () => {
      state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - pathTiles.length);
      if (pathTiles.length > 0) {
        showFloatingTextOverEntity(scene, monster, `${pathTiles.length}`, {
          color: "#22c55e",
        });
      }
      delay(scene, POST_MOVE_DELAY_MS, () => {
        if (canCastSpellOnTile(scene, monster, eclat, px, py, map)) {
          castSequenceEclat(2);
          return;
        }
        fleeAfterAttack();
      });
    });
  };

  if (rugissement) {
    const pos = getMonsterTile();
    const reachable = buildReachableTiles(pos.x, pos.y, state.pmRestants ?? 0);
    if (reachable.length > 0) {
      const playerDist = (entry) =>
        Math.abs(px - entry.x) + Math.abs(py - entry.y);
      const best = reachable.reduce(
        (acc, entry) => {
          const count = countAlliesInRadius(entry.x, entry.y, 2);
          const steps = entry.path.length;
          const dist = playerDist(entry);
          if (
            count > acc.count ||
            (count === acc.count && steps < acc.steps) ||
            (count === acc.count && steps === acc.steps && dist < acc.dist)
          ) {
            return { entry, count, steps, dist };
          }
          return acc;
        },
        { entry: reachable[0], count: -1, steps: 999, dist: 999 }
      ).entry;

      const pathTiles = best.path || [];
      const castAfterMove = () => {
        if (tryCastRugissement()) {
          delay(scene, POST_ATTACK_DELAY_MS, runOffense);
        } else {
          runOffense();
        }
      };

      if (pathTiles.length === 0) {
        castAfterMove();
        return;
      }

      moveMonsterAlongPath(scene, monster, map, groundLayer, pathTiles, () => {
        state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - pathTiles.length);
        if (pathTiles.length > 0) {
          showFloatingTextOverEntity(scene, monster, `${pathTiles.length}`, {
            color: "#22c55e",
          });
        }
        delay(scene, POST_MOVE_DELAY_MS, castAfterMove);
      });
      return;
    }
  }

  runOffense();
}
