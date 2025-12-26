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

// IA du Goush :
// - priorité à Bave puante si possible
// - ensuite morsure si au contact
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

  const goushSpells = monsterSpells.goush || {};
  const morsure = goushSpells.morsure;
  const bavePuante = goushSpells.bave_puante;

  const tryMorsure = () => {
    if (!morsure) return false;
    const st = scene.combatState;
    if (!st || !st.enCours) return false;
    if (!canCastSpellOnTile(scene, monster, morsure, px, py, map)) return false;
    return castSpellAtTile(scene, monster, morsure, px, py, map, groundLayer);
  };

  const tryBavePuante = () => {
    if (!bavePuante) return false;
    const st = scene.combatState;
    if (!st || !st.enCours) return false;
    if (!canCastSpellOnTile(scene, monster, bavePuante, px, py, map)) return false;
    return castSpellAtTile(scene, monster, bavePuante, px, py, map, groundLayer);
  };

  const dist = Math.abs(px - mx) + Math.abs(py - my);

  const doMelee = () => {
    const didPoison = tryBavePuante();
    delay(scene, POST_ATTACK_DELAY_MS, () => {
      tryMorsure();
      onComplete?.();
    });
  };

  const doMoveThenActions = () => {
    if (pmRestants <= 0) {
      onComplete?.();
      return;
    }

    const bfsPath =
      findPathToReachAdjacentToTarget(scene, map, mx, my, px, py, 60, monster) || [];

    const pathTiles = bfsPath.length > 0 ? bfsPath.slice(0, pmRestants) : [];
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
        const didPoison = tryBavePuante();
        delay(scene, POST_ATTACK_DELAY_MS, () => {
          tryMorsure();
          onComplete?.();
        });
      });
    });
  };

  if (dist === 1) {
    doMelee();
    return;
  }

  const didPoison = tryBavePuante();
  if (didPoison) delay(scene, POST_ATTACK_DELAY_MS, doMoveThenActions);
  else doMoveThenActions();
}
