import { monsterSpells } from "../../../content/spells/monsters/index.js";
import { castSpellAtTile, canCastSpellOnTile } from "../../../core/spellSystem.js";
import { showFloatingTextOverEntity } from "../../../core/combat/floatingText.js";
import {
  delay,
  moveMonsterAlongPath,
  findPathToReachAdjacentToTarget,
} from "../../../monsters/aiUtils.js";

// IA Cèdre :
// - applique Sève toxique en priorité si possible et si la cible n'a pas déjà l'effet
// - ensuite frappe de ronce au corps a corps
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

  const spells = monsterSpells.cedre || {};
  const melee = spells.ronce;
  const poison = spells.seve_toxique;

  const playerHasPoison = () =>
    Array.isArray(player.statusEffects) &&
    player.statusEffects.some((e) => e && e.id === "seve_toxique" && (e.turnsLeft ?? 0) > 0);

  const tryCast = (spell) => {
    if (!spell) return false;
    const st = scene.combatState;
    if (!st || !st.enCours) return false;
    if (!canCastSpellOnTile(scene, monster, spell, px, py, map)) return false;
    return castSpellAtTile(scene, monster, spell, px, py, map, groundLayer);
  };

  const dist = Math.abs(px - mx) + Math.abs(py - my);
  const finish = () => onComplete?.();

  if (!playerHasPoison() && tryCast(poison)) {
    delay(scene, 260, () => {
      if (dist === 1) tryCast(melee);
      finish();
    });
    return;
  }

  if (dist === 1) {
    const did = tryCast(melee);
    delay(scene, did ? 220 : 120, () => {
      tryCast(melee);
      finish();
    });
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
    if (tryCast(poison)) delay(scene, 260, finish);
    else finish();
    return;
  }

  moveMonsterAlongPath(scene, monster, map, groundLayer, pathTiles, () => {
    state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - pathTiles.length);
    if (pathTiles.length > 0) {
      showFloatingTextOverEntity(scene, monster, `${pathTiles.length}`, {
        color: "#22c55e",
        depth: 0,
      });
    }
    delay(scene, 520, () => {
      const didPoison = !playerHasPoison() && tryCast(poison);
      delay(scene, didPoison ? 260 : 140, () => {
        tryCast(melee);
        finish();
      });
    });
  });
}
