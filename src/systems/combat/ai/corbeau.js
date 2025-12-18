import { monsterSpells } from "../../../content/spells/monsters/index.js";
import { castSpellAtTile, canCastSpellOnTile } from "../../../core/spellSystem.js";
import { showFloatingTextOverEntity } from "../../../core/combat/floatingText.js";
import {
  delay,
  moveMonsterAlongPath,
  findPathToReachAdjacentToTarget,
} from "../../../monsters/aiUtils.js";

// IA du corbeau : approche simple + coup de bec au corps a corps.
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

  const stats = monster.stats || {};
  const hp = stats.hp ?? stats.hpMax ?? 0;
  const hpMax = stats.hpMax || 1;
  const fleeing = hp / hpMax < 0.1;

  const spellBook =
    monsterSpells[monster.monsterId] || monsterSpells.corbeau || {};
  const primarySpellId =
    Array.isArray(monster.spellIds) && monster.spellIds.length > 0
      ? monster.spellIds[0]
      : null;
  const coupDeBec =
    (primarySpellId && spellBook[primarySpellId]) ||
    spellBook.bec_de_zephyr ||
    spellBook.coup_de_bec ||
    Object.values(spellBook)[0] ||
    null;

  const tryMeleeAttack = () => {
    if (!coupDeBec) return false;
    const st = scene.combatState;
    if (!st || !st.enCours) return false;
    if (!canCastSpellOnTile(scene, monster, coupDeBec, px, py, map)) return false;
    return castSpellAtTile(scene, monster, coupDeBec, px, py, map, groundLayer);
  };

  if (!fleeing && tryMeleeAttack()) {
    onComplete?.();
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
        depth: 0,
      });
    }

    const finalMx = monster.tileX ?? mx;
    const finalMy = monster.tileY ?? my;
    const distAfterMove = Math.abs(px - finalMx) + Math.abs(py - finalMy);

    delay(scene, 520, () => {
      if (!fleeing && distAfterMove === 1) {
        tryMeleeAttack();
      }
      delay(scene, 140, () => onComplete?.());
    });
  });
}
