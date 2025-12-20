import { monsterSpells } from "../../../content/spells/monsters/index.js";
import { castSpellAtTile, canCastSpellOnTile } from "../../../core/spellSystem.js";
import { showFloatingTextOverEntity } from "../../../core/combat/floatingText.js";
import {
  delay,
  moveMonsterAlongPath,
  findPathToReachAdjacentToTarget,
} from "../../../monsters/aiUtils.js";

// IA Gumgob :
// - essaie de taper à distance (Jet de caillou) si possible
// - sinon se rapproche pour Coup de massue
export function runTurn(scene, state, monster, player, map, groundLayer, onComplete) {
  const pmRestants = state.pmRestants ?? 0;

  if (typeof monster.tileX !== "number" || typeof monster.tileY !== "number") {
    const t = map.worldToTileXY(monster.x, monster.y, true, undefined, undefined, groundLayer);
    if (t) {
      monster.tileX = t.x;
      monster.tileY = t.y;
    }
  }

  const mx = monster.tileX ?? 0;
  const my = monster.tileY ?? 0;

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

  const spells = monsterSpells.gumgob || {};
  const melee = spells.coup_de_massue;
  const ranged = spells.jet_de_caillou;

  const tryCast = (spell) => {
    if (!spell) return false;
    const st = scene.combatState;
    if (!st || !st.enCours) return false;
    if (!canCastSpellOnTile(scene, monster, spell, px, py, map)) return false;
    return castSpellAtTile(scene, monster, spell, px, py, map, groundLayer);
  };

  const dist = Math.abs(px - mx) + Math.abs(py - my);
  const finish = () => onComplete?.();

  if (tryCast(ranged)) {
    delay(scene, 260, () => {
      if (dist === 1) tryCast(melee);
      finish();
    });
    return;
  }

  if (dist === 1) {
    const did = tryCast(melee);
    delay(scene, did ? 240 : 120, finish);
    return;
  }

  if (pmRestants <= 0) {
    finish();
    return;
  }

  const path =
    findPathToReachAdjacentToTarget(scene, map, mx, my, px, py, 60, monster) || [];
  const pathTiles = path.length > 0 ? path.slice(0, pmRestants) : [];
  if (pathTiles.length === 0) {
    finish();
    return;
  }

  moveMonsterAlongPath(scene, monster, map, groundLayer, pathTiles, () => {
    state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - pathTiles.length);
  if (pathTiles.length > 0) {
    showFloatingTextOverEntity(scene, monster, `${pathTiles.length}`, {
      color: "#22c55e",
    });
  }
    delay(scene, 520, () => {
      tryCast(melee);
      finish();
    });
  });
}
