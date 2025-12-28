import { monsterSpells } from "../../../content/spells/monsters/index.js";
import {
  castSpellAtTile,
  isSpellInRangeFromPosition,
  canCastSpellOnTile,
} from "../spells/index.js";
import { showFloatingTextOverEntity } from "../runtime/floatingText.js";
import {
  delay,
  moveMonsterAlongPath,
  isTileOccupiedByMonster,
} from "../../../features/monsters/ai/aiUtils.js";

const POST_MOVE_DELAY_MS = 250;
const POST_ATTACK_DELAY_MS = 150;

// IA d'Aluineeks :
// - ne recule jamais
// - se place en ligne à 1-2 cases pour lancer Fissure (jusqu'à 2 fois)
export function runTurn(scene, state, monster, player, map, groundLayer, onComplete) {
  let pmRestants = state.pmRestants ?? 0;

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

  const aluSpells = monsterSpells.aluineeks || {};
  const fissure = aluSpells.fissure;

  const isInFissureRange = (tx, ty) => {
    if (!fissure) return false;
    return isSpellInRangeFromPosition(fissure, tx, ty, px, py);
  };

  const tryCastFissure = () => {
    if (!fissure) return false;
    const st = scene.combatState;
    if (!st || !st.enCours) return false;
    if (!canCastSpellOnTile(scene, monster, fissure, px, py, map)) return false;
    return castSpellAtTile(scene, monster, fissure, px, py, map, groundLayer);
  };

  const pathTiles = [];

  const candidateTargets = [];
  for (let d = 1; d <= 2; d += 1) {
    candidateTargets.push({ x: px + d, y: py });
    candidateTargets.push({ x: px - d, y: py });
    candidateTargets.push({ x: px, y: py + d });
    candidateTargets.push({ x: px, y: py - d });
  }

  let bestTarget = null;
  let bestDistFromMonster = Infinity;

  for (const c of candidateTargets) {
    if (c.x < 0 || c.x >= map.width || c.y < 0 || c.y >= map.height) continue;
    if (!isInFissureRange(c.x, c.y)) continue;

    const distFromMonster = Math.abs(c.x - mx) + Math.abs(c.y - my);
    if (distFromMonster === 0) {
      bestTarget = c;
      bestDistFromMonster = 0;
      break;
    }
    if (distFromMonster <= pmRestants && distFromMonster < bestDistFromMonster) {
      bestTarget = c;
      bestDistFromMonster = distFromMonster;
    }
  }

  if (bestTarget) {
    let cx = mx;
    let cy = my;
    while ((cx !== bestTarget.x || cy !== bestTarget.y) && pathTiles.length < pmRestants) {
      const dx = bestTarget.x - cx;
      const dy = bestTarget.y - cy;
      let stepX = 0;
      let stepY = 0;

      if (Math.abs(dx) >= Math.abs(dy)) stepX = dx === 0 ? 0 : Math.sign(dx);
      else stepY = dy === 0 ? 0 : Math.sign(dy);

      if (stepX === 0 && stepY === 0) break;

      const nextX = cx + stepX;
      const nextY = cy + stepY;
      if (nextX < 0 || nextX >= map.width || nextY < 0 || nextY >= map.height) break;
      if (isTileOccupiedByMonster(scene, nextX, nextY, monster)) break;

      cx = nextX;
      cy = nextY;
      pathTiles.push({ x: cx, y: cy });
    }

    if (pathTiles.length > 0) {
      const last = pathTiles[pathTiles.length - 1];
      mx = last.x;
      my = last.y;
    }
  } else {
    while (pmRestants > 0 && !isInFissureRange(mx, my)) {
      const dx = px - mx;
      const dy = py - my;
      const dist = Math.abs(dx) + Math.abs(dy);

      let stepX = 0;
      let stepY = 0;
      if (Math.abs(dx) >= Math.abs(dy)) stepX = dx === 0 ? 0 : Math.sign(dx);
      else stepY = dy === 0 ? 0 : Math.sign(dy);
      if (stepX === 0 && stepY === 0) break;

      const nextX = mx + stepX;
      const nextY = my + stepY;
      if (nextX < 0 || nextX >= map.width || nextY < 0 || nextY >= map.height) break;
      if (isTileOccupiedByMonster(scene, nextX, nextY, monster)) break;

      const newDist = Math.abs(px - nextX) + Math.abs(py - nextY);
      if (newDist > dist) break;

      mx = nextX;
      my = nextY;
      pmRestants -= 1;
      pathTiles.push({ x: mx, y: my });
    }
  }

  const afterMoveAndCast = (moved) => {
    state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - pathTiles.length);
    if (pathTiles.length > 0) {
      showFloatingTextOverEntity(scene, monster, `${pathTiles.length}`, {
        color: "#22c55e",
      });
    }

    const castSequence = (castIndex) => {
      const st = scene.combatState;
      if (!st || !st.enCours) {
        onComplete?.();
        return;
      }
      if (castIndex >= 2) {
        onComplete?.();
        return;
      }
      if (!isInFissureRange(monster.tileX ?? mx, monster.tileY ?? my)) {
        onComplete?.();
        return;
      }
      const ok = tryCastFissure();
      if (!ok) {
        onComplete?.();
        return;
      }
      if (scene.time?.delayedCall) {
        scene.time.delayedCall(POST_ATTACK_DELAY_MS, () => castSequence(castIndex + 1));
      }
      else castSequence(castIndex + 1);
    };

    delay(scene, moved ? POST_MOVE_DELAY_MS : POST_ATTACK_DELAY_MS, () => castSequence(0));
  };

  if (pathTiles.length === 0) {
    delay(scene, POST_ATTACK_DELAY_MS, () => afterMoveAndCast(false));
    return;
  }

  moveMonsterAlongPath(scene, monster, map, groundLayer, pathTiles, () => afterMoveAndCast(true));
}
