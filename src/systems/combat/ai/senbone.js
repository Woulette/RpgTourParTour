import { monsterSpells } from "../../../content/spells/monsters/index.js";
import {
  castSpellAtTile,
  isSpellInRangeFromPosition,
  canCastSpellOnTile,
  canCastSpell,
} from "../../../core/spellSystem.js";
import { showFloatingTextOverEntity } from "../../../core/combat/floatingText.js";
import {
  delay,
  moveMonsterAlongPath,
  findPathToReachAdjacentToTarget,
} from "../../../monsters/aiUtils.js";

const POST_MOVE_DELAY_MS = 250;
const POST_ATTACK_DELAY_MS = 150;

function findSummonTargetTiles(mx, my) {
  return [
    { x: mx + 1, y: my },
    { x: mx - 1, y: my },
    { x: mx, y: my + 1 },
    { x: mx, y: my - 1 },
    { x: mx + 1, y: my + 1 },
    { x: mx - 1, y: my + 1 },
    { x: mx + 1, y: my - 1 },
    { x: mx - 1, y: my - 1 },
  ];
}

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

  const spells = monsterSpells.senbone || {};
  const fissure = spells.fissure;
  const solitude = spells.solitude;

  const trySummon = () => {
    if (!solitude) return false;
    if (!canCastSpell(scene, monster, solitude)) return false;
    const candidates = findSummonTargetTiles(mx, my);
    for (const c of candidates) {
      if (c.x < 0 || c.x >= map.width || c.y < 0 || c.y >= map.height) continue;
      if (!canCastSpellOnTile(scene, monster, solitude, c.x, c.y, map)) continue;
      return castSpellAtTile(scene, monster, solitude, c.x, c.y, map, groundLayer);
    }
    return false;
  };

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

  trySummon();

  const pathTiles =
    findPathToReachAdjacentToTarget(scene, map, mx, my, px, py, pmRestants, monster) || [];
  const steps = pathTiles.length > 0 ? pathTiles.slice(0, pmRestants) : [];

  const afterMoveAndCast = (moved) => {
    state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - steps.length);
    if (steps.length > 0) {
      showFloatingTextOverEntity(scene, monster, `${steps.length}`, {
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
      } else {
        castSequence(castIndex + 1);
      }
    };

    delay(scene, moved ? POST_MOVE_DELAY_MS : POST_ATTACK_DELAY_MS, () => castSequence(0));
  };

  if (steps.length === 0) {
    delay(scene, POST_ATTACK_DELAY_MS, () => afterMoveAndCast(false));
    return;
  }

  moveMonsterAlongPath(scene, monster, map, groundLayer, steps, () => afterMoveAndCast(true));
}
