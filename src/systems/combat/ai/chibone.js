import { monsterSpells } from "../../../content/spells/monsters/index.js";
import { castSpellAtTile, canCastSpellOnTile } from "../../../core/spellSystem.js";
import { showFloatingTextOverEntity } from "../../../core/combat/floatingText.js";
import {
  delay,
  moveMonsterAlongPath,
  findPathToReachAdjacentToTarget,
} from "../../../monsters/aiUtils.js";

const POST_MOVE_DELAY_MS = 250;
const POST_ATTACK_DELAY_MS = 150;

// IA du Chibone : se colle au corps a corps et frappe deux fois.
export function runTurn(scene, state, monster, player, map, groundLayer, onComplete) {
  let pmRestants = state.pmRestants ?? 0;
  if (pmRestants <= 0) {
    onComplete?.();
    return;
  }

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

  const spellBook = monsterSpells.chibone || {};
  const machoire = spellBook.machoire || Object.values(spellBook)[0] || null;

  const tryMeleeAttack = () => {
    if (!machoire) return false;
    const st = scene.combatState;
    if (!st || !st.enCours) return false;
    if (!canCastSpellOnTile(scene, monster, machoire, px, py, map)) return false;
    return castSpellAtTile(scene, monster, machoire, px, py, map, groundLayer);
  };

  const tryAttackTwice = () => {
    const first = tryMeleeAttack();
    const second = tryMeleeAttack();
    delay(scene, first || second ? POST_ATTACK_DELAY_MS : 80, () => onComplete?.());
  };

  if (tryMeleeAttack()) {
    delay(scene, POST_ATTACK_DELAY_MS, () => {
      tryMeleeAttack();
      delay(scene, POST_ATTACK_DELAY_MS, () => onComplete?.());
    });
    return;
  }

  let stepsUsed = 0;
  const pathTiles = [];
  const bfsPath =
    findPathToReachAdjacentToTarget(scene, map, mx, my, px, py, 50, monster) || [];

  if (bfsPath.length > 0) {
    const slice = bfsPath.slice(0, pmRestants);
    slice.forEach((step) => {
      mx = step.x;
      my = step.y;
      stepsUsed += 1;
      pathTiles.push({ x: mx, y: my });
    });
  }

  if (stepsUsed === 0 || pathTiles.length === 0) {
    onComplete?.();
    return;
  }

  moveMonsterAlongPath(scene, monster, map, groundLayer, pathTiles, () => {
    state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - stepsUsed);
    if (stepsUsed > 0) {
      showFloatingTextOverEntity(scene, monster, `${stepsUsed}`, {
        color: "#22c55e",
      });
    }

    const finalMx = monster.tileX ?? mx;
    const finalMy = monster.tileY ?? my;
    const distAfterMove = Math.abs(px - finalMx) + Math.abs(py - finalMy);

    delay(scene, POST_MOVE_DELAY_MS, () => {
      if (distAfterMove === 1) {
        tryAttackTwice();
        return;
      }
      delay(scene, POST_ATTACK_DELAY_MS, () => onComplete?.());
    });
  });
}
