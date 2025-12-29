import { monsterSpells } from "../../../content/spells/monsters/index.js";
import { castSpellAtTile, canCastSpellOnTile, canCastSpell } from "../spells/index.js";
import { showFloatingTextOverEntity } from "../runtime/floatingText.js";
import {
  delay,
  moveMonsterAlongPath,
  findPathToReachAdjacentToTarget,
} from "../../../features/monsters/ai/aiUtils.js";
import { getAliveCombatMonsters, isTileOccupiedByMonster } from "../../../features/monsters/ai/aiUtils.js";
import { isTileBlocked } from "../../../collision/collisionGrid.js";
import { isTileAvailableForSpell } from "../spells/utils/util.js";

const POST_MOVE_DELAY_MS = 250;
const POST_ATTACK_DELAY_MS = 300;

// IA Cèdre :
// - repousse au corps a corps si possible
// - cherche a maximiser le nombre d'alliés dans l'aura
// - apres buff, revient vers le joueur si possible
export function runTurn(scene, state, monster, player, map, groundLayer, onComplete) {
  const debug = () => {};
  if (typeof monster.tileX !== "number" || typeof monster.tileY !== "number") {
    const t = map.worldToTileXY(monster.x, monster.y, true, undefined, undefined, groundLayer);
    if (t) {
      monster.tileX = t.x;
      monster.tileY = t.y;
    }
  }

  const mx = monster.tileX ?? 0;
  const my = monster.tileY ?? 0;

  const spells = monsterSpells.cedre || {};
  const aura = spells.aura_cedre;
  const push = spells.souffle_cedre;

  const getPlayerTile = () => {
    let tx = player.currentTileX;
    let ty = player.currentTileY;
    if (typeof tx !== "number" || typeof ty !== "number") {
      const t = map.worldToTileXY(player.x, player.y, true, undefined, undefined, groundLayer);
      if (t) {
        tx = t.x;
        ty = t.y;
      }
    }
    if (typeof tx !== "number" || typeof ty !== "number") return null;
    return { x: tx, y: ty };
  };

  const tryCast = (spell) => {
    if (!spell) return false;
    const st = scene.combatState;
    if (!st || !st.enCours) return false;
    const tile = getPlayerTile();
    if (!tile) return false;
    if (!canCastSpellOnTile(scene, monster, spell, tile.x, tile.y, map)) return false;
    return castSpellAtTile(scene, monster, spell, tile.x, tile.y, map, groundLayer);
  };

  const tryAura = () => {
    if (!aura) return false;
    const st = scene.combatState;
    if (!st || !st.enCours) return false;
    const ax = typeof monster.tileX === "number" ? monster.tileX : mx;
    const ay = typeof monster.tileY === "number" ? monster.tileY : my;
    if (!canCastSpellOnTile(scene, monster, aura, ax, ay, map)) return false;
    return castSpellAtTile(scene, monster, aura, ax, ay, map, groundLayer);
  };

  const finish = () => onComplete?.();

  const countAlliesInRadius = (cx, cy, radius) => {
    const list = getAliveCombatMonsters(scene);
    return list.reduce((acc, m) => {
      if (!m || typeof m.tileX !== "number" || typeof m.tileY !== "number") return acc;
      const d = Math.abs(m.tileX - cx) + Math.abs(m.tileY - cy);
      return d <= radius ? acc + 1 : acc;
    }, 0);
  };

  const buildReachableTiles = (startX, startY, maxSteps) => {
    const results = [];
    const queue = [{ x: startX, y: startY, path: [] }];
    const visited = new Set([`${startX},${startY}`]);
    const playerTile = getPlayerTile();

    while (queue.length > 0) {
      const cur = queue.shift();
      results.push(cur);
      if (cur.path.length >= maxSteps) continue;

      const dirs = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
      ];

      for (const dir of dirs) {
        const nx = cur.x + dir.dx;
        const ny = cur.y + dir.dy;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        if (isTileBlocked(scene, nx, ny)) continue;
        if (isTileOccupiedByMonster(scene, nx, ny, monster)) continue;
        if (playerTile && playerTile.x === nx && playerTile.y === ny) continue;
        visited.add(key);
        queue.push({ x: nx, y: ny, path: [...cur.path, { x: nx, y: ny }] });
      }
    }

    return results;
  };

  const computeBlockedCellsForPush = (casterX, casterY, playerTile, pushDistance) => {
    const dist = typeof pushDistance === "number" ? Math.max(0, pushDistance) : 0;
    if (dist <= 0) return 0;
    if (!playerTile) return 0;
    const dx = playerTile.x - casterX;
    const dy = playerTile.y - casterY;
    const stepX = dx === 0 ? 0 : Math.sign(dx);
    const stepY = dy === 0 ? 0 : Math.sign(dy);
    if (stepX === 0 && stepY === 0) return 0;

    let moved = 0;
    for (let i = 1; i <= dist; i += 1) {
      const nx = playerTile.x + stepX * i;
      const ny = playerTile.y + stepY * i;
      if (!isTileAvailableForSpell(map, nx, ny)) break;
      if (isTileBlocked(scene, nx, ny)) break;
      if (isTileOccupiedByMonster(scene, nx, ny, monster)) break;
      moved = i;
    }
    return dist - moved;
  };

  const findBestPushSetup = (maxSteps) => {
    if (!push || !canCastSpell(scene, monster, push)) return null;
    const playerTile = getPlayerTile();
    if (!playerTile) return null;
    const dist = push.pushbackDistance ?? 0;
    if (dist <= 0) return null;

    const reachable = buildReachableTiles(monster.tileX, monster.tileY, maxSteps);
    let best = null;

    reachable.forEach((entry) => {
      const isAdjacent =
        Math.abs(entry.x - playerTile.x) + Math.abs(entry.y - playerTile.y) === 1;
      if (!isAdjacent) return;
      const blocked = computeBlockedCellsForPush(entry.x, entry.y, playerTile, dist);
      if (blocked <= 0) return;
      if (!best) {
        best = { entry, blocked };
        return;
      }
      if (
        blocked > best.blocked ||
        (blocked === best.blocked && entry.path.length < best.entry.path.length)
      ) {
        best = { entry, blocked };
      }
    });

    return best;
  };

  const moveTowardPlayer = (onArrive) => {
    if (state.pmRestants <= 0) {
      if (typeof onArrive === "function") onArrive();
      else finish();
      return;
    }
    const playerTile = getPlayerTile();
    if (!playerTile) {
      if (typeof onArrive === "function") onArrive();
      else finish();
      return;
    }
    const bfsPath =
      findPathToReachAdjacentToTarget(
        scene,
        map,
        monster.tileX,
        monster.tileY,
        playerTile.x,
        playerTile.y,
        60,
        monster
      ) || [];
    const pathTiles = bfsPath.length > 0 ? bfsPath.slice(0, state.pmRestants) : [];
    if (pathTiles.length === 0) {
      if (typeof onArrive === "function") onArrive();
      else finish();
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
        if (typeof onArrive === "function") onArrive();
        else finish();
      });
    });
  };

  const moveTowardBestPushSetup = (onArrive) => {
    if (!push || !canCastSpell(scene, monster, push)) {
      moveTowardPlayer(onArrive);
      return;
    }
    const bestSetup = findBestPushSetup(state.pmRestants ?? 0);
    if (!bestSetup || !bestSetup.entry || bestSetup.entry.path.length === 0) {
      moveTowardPlayer(onArrive);
      return;
    }
    const pathTiles = bestSetup.entry.path;
    moveMonsterAlongPath(scene, monster, map, groundLayer, pathTiles, () => {
      state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - pathTiles.length);
      if (pathTiles.length > 0) {
        showFloatingTextOverEntity(scene, monster, `${pathTiles.length}`, {
          color: "#22c55e",
        });
      }
      delay(scene, POST_MOVE_DELAY_MS, () => {
        if (typeof onArrive === "function") onArrive();
        else finish();
      });
    });
  };

  const tryAuraSequence = (onAfter) => {
    if (!aura || !canCastSpell(scene, monster, aura)) return false;

    const reachable = buildReachableTiles(monster.tileX, monster.tileY, state.pmRestants ?? 0);
    if (reachable.length === 0) {
      debug();
      if (tryAura()) delay(scene, POST_ATTACK_DELAY_MS, () => moveTowardBestPushSetup(onAfter));
      return true;
    }

    const playerTile = getPlayerTile();
    const best = reachable.reduce(
      (acc, entry) => {
        const count = countAlliesInRadius(entry.x, entry.y, 2);
        const distToPlayer = playerTile
          ? Math.abs(playerTile.x - entry.x) + Math.abs(playerTile.y - entry.y)
          : 0;
        if (
          count > acc.count ||
          (count === acc.count && entry.path.length < acc.steps) ||
          (count === acc.count && entry.path.length === acc.steps && distToPlayer < acc.distToPlayer)
        ) {
          return {
            entry,
            count,
            steps: entry.path.length,
            distToPlayer,
          };
        }
        return acc;
      },
      { entry: reachable[0], count: -1, steps: 999, distToPlayer: 999 }
    ).entry;

    const pathTiles = best.path || [];
    const castAfterMove = () => {
      if (tryAura()) {
        debug();
        delay(scene, POST_ATTACK_DELAY_MS, () => moveTowardBestPushSetup(onAfter));
      } else {
        debug();
        moveTowardBestPushSetup(onAfter);
      }
    };

    if (pathTiles.length === 0) {
      debug();
      castAfterMove();
      return true;
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
    return true;
  };

  const tryMeleePushCombo = (onDone) => {
    const maxCasts =
      typeof push?.maxCastsPerTurn === "number" && push.maxCastsPerTurn > 0
        ? push.maxCastsPerTurn
        : 1;
    let casts = 0;
    let lastTargetTileKey = null;

    const step = () => {
      const playerTile = getPlayerTile();
      if (!playerTile) {
        debug();
        onDone?.();
        return;
      }

      const dist = Math.abs(playerTile.x - monster.tileX) + Math.abs(playerTile.y - monster.tileY);

      if (state.pmRestants > 0) {
        const bestSetup = findBestPushSetup(state.pmRestants ?? 0);
        if (bestSetup && bestSetup.entry.path.length > 0) {
          const pathTiles = bestSetup.entry.path;
          moveMonsterAlongPath(scene, monster, map, groundLayer, pathTiles, () => {
            state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - pathTiles.length);
            if (pathTiles.length > 0) {
              showFloatingTextOverEntity(scene, monster, `${pathTiles.length}`, {
                color: "#22c55e",
              });
            }
            delay(scene, POST_MOVE_DELAY_MS, step);
          });
          return;
        }
      }

      if (dist !== 1) {
        debug();
        if (state.pmRestants <= 0) {
          onDone?.();
          return;
        }
        const bfsPath =
          findPathToReachAdjacentToTarget(
            scene,
            map,
            monster.tileX,
            monster.tileY,
            playerTile.x,
            playerTile.y,
            60,
            monster
          ) || [];
        const pathTiles = bfsPath.length > 0 ? bfsPath.slice(0, state.pmRestants) : [];
        if (pathTiles.length === 0) {
          debug();
          onDone?.();
          return;
        }
        moveMonsterAlongPath(scene, monster, map, groundLayer, pathTiles, () => {
          state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - pathTiles.length);
          if (pathTiles.length > 0) {
            showFloatingTextOverEntity(scene, monster, `${pathTiles.length}`, {
              color: "#22c55e",
            });
          }
          delay(scene, POST_MOVE_DELAY_MS, step);
        });
        return;
      }

      if (!push || !canCastSpell(scene, monster, push) || casts >= maxCasts) {
        debug();
        onDone?.();
        return;
      }

      if (!canCastSpellOnTile(scene, monster, push, playerTile.x, playerTile.y, map)) {
        debug();
        onDone?.();
        return;
      }

      const beforeTileKey = `${playerTile.x},${playerTile.y}`;
      debug();
      tryCast(push);
      casts += 1;
      delay(scene, POST_ATTACK_DELAY_MS, () => {
        const afterTile = getPlayerTile();
        const afterKey = afterTile ? `${afterTile.x},${afterTile.y}` : null;
        if (afterKey && afterKey === beforeTileKey && lastTargetTileKey === beforeTileKey) {
          onDone?.();
          return;
        }
        lastTargetTileKey = beforeTileKey;
        step();
      });
    };

    step();
  };

  const initialPlayerTile = getPlayerTile();
  const dist = initialPlayerTile
    ? Math.abs(initialPlayerTile.x - mx) + Math.abs(initialPlayerTile.y - my)
    : 999;

  debug();

  const tryEngageAfterMove = () => {
    const playerTile = getPlayerTile();
    if (!playerTile) {
      finish();
      return;
    }
    const distToPlayer =
      Math.abs(playerTile.x - monster.tileX) + Math.abs(playerTile.y - monster.tileY);
    if (distToPlayer === 1 && push && canCastSpell(scene, monster, push)) {
      tryMeleePushCombo(finish);
      return;
    }
    finish();
  };

  if (dist === 1) {
    debug();
    if (push && canCastSpell(scene, monster, push)) {
      tryMeleePushCombo(() => {
        if (tryAuraSequence()) return;
        moveTowardBestPushSetup();
      });
      return;
    }
    if (tryAuraSequence()) {
      return;
    }
    moveTowardBestPushSetup();
    return;
  }

  if (tryAuraSequence(tryEngageAfterMove)) return;
  moveTowardBestPushSetup(tryEngageAfterMove);
}
