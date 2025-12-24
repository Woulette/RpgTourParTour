import { monsterSpells } from "../../../content/spells/monsters/index.js";
import { castSpellAtTile, canCastSpellOnTile } from "../../../core/spellSystem.js";
import { showFloatingTextOverEntity } from "../../../core/combat/floatingText.js";
import {
  delay,
  moveMonsterAlongPath,
  findPathToReachAdjacentToTarget,
} from "../../../monsters/aiUtils.js";

// IA de Libarene :
// - melee pur : priorise la frappe lourde, puis la griffure
export function runTurn(scene, state, monster, player, map, groundLayer, onComplete) {
  if (typeof monster.tileX !== "number" || typeof monster.tileY !== "number") {
    const t = map.worldToTileXY(monster.x, monster.y, true, undefined, undefined, groundLayer);
    if (t) {
      monster.tileX = t.x;
      monster.tileY = t.y;
    }
  }

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

  const spells = monsterSpells.libarene || {};
  const heavy = spells.taille_libarene;
  const light = spells.griffure_libarene;

  const tryCastOnPlayer = (spell) => {
    const tile = getPlayerTile();
    if (!tile) return false;
    const st = scene.combatState;
    if (!st || !st.enCours) return false;
    if (!canCastSpellOnTile(scene, monster, spell, tile.x, tile.y, map)) return false;
    return castSpellAtTile(scene, monster, spell, tile.x, tile.y, map, groundLayer);
  };

  const doMelee = () => {
    const didHeavy = heavy ? tryCastOnPlayer(heavy) : false;
    delay(scene, didHeavy ? 240 : 120, () => {
      if (light) {
        tryCastOnPlayer(light);
      }
      onComplete?.();
    });
  };

  const doMoveThenMelee = () => {
    const pmRestants = state.pmRestants ?? 0;
    if (pmRestants <= 0) {
      onComplete?.();
      return;
    }

    const playerTile = getPlayerTile();
    if (!playerTile) {
      onComplete?.();
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
      delay(scene, 260, doMelee);
    });
  };

  const playerTile = getPlayerTile();
  if (!playerTile) {
    onComplete?.();
    return;
  }
  const dist =
    Math.abs(playerTile.x - (monster.tileX ?? 0)) +
    Math.abs(playerTile.y - (monster.tileY ?? 0));

  if (dist === 1) {
    doMelee();
    return;
  }

  doMoveThenMelee();
}
