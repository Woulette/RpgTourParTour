import { monsterSpells } from "../config/monsterSpells.js";
import { castSpellAtTile, canCastSpellOnTile } from "../core/spellSystem.js";
import { showFloatingTextOverEntity } from "../core/combat/floatingText.js";
import {
  delay,
  moveMonsterAlongPath,
  findPathToReachAdjacentToTarget,
} from "./aiUtils.js";

// IA du Goush :
// - priorite a Bave puante si possible
// - ensuite morsure si au contact
// - ajoute des delais pour rendre le tour lisible
export function runTurn(
  scene,
  state,
  monster,
  player,
  map,
  groundLayer,
  onComplete
) {
  const pmRestants = state.pmRestants ?? 0;

  // Securise les coords de tuile du monstre
  if (typeof monster.tileX !== "number" || typeof monster.tileY !== "number") {
    const t = map.worldToTileXY(
      monster.x,
      monster.y,
      true,
      undefined,
      undefined,
      groundLayer
    );
    if (t) {
      monster.tileX = t.x;
      monster.tileY = t.y;
    }
  }

  const mx = monster.tileX ?? 0;
  const my = monster.tileY ?? 0;

  // Position du joueur en tuiles
  let px = player.currentTileX;
  let py = player.currentTileY;
  if (typeof px !== "number" || typeof py !== "number") {
    const t = map.worldToTileXY(
      player.x,
      player.y,
      true,
      undefined,
      undefined,
      groundLayer
    );
    if (t) {
      px = t.x;
      py = t.y;
    } else {
      if (typeof onComplete === "function") onComplete();
      return;
    }
  }

  const goushSpells = monsterSpells.goush || {};
  const morsure = goushSpells.morsure;
  const bavePuante = goushSpells.bave_puante;

  const tryMorsure = () => {
    if (!morsure) return false;
    const stateNow = scene.combatState;
    if (!stateNow || !stateNow.enCours) return false;
    const canHit = canCastSpellOnTile(scene, monster, morsure, px, py, map);
    if (!canHit) return false;
    return castSpellAtTile(scene, monster, morsure, px, py, map, groundLayer);
  };

  const tryBavePuante = () => {
    if (!bavePuante) return false;
    const stateNow = scene.combatState;
    if (!stateNow || !stateNow.enCours) return false;
    const canHit = canCastSpellOnTile(scene, monster, bavePuante, px, py, map);
    if (!canHit) return false;
    return castSpellAtTile(
      scene,
      monster,
      bavePuante,
      px,
      py,
      map,
      groundLayer
    );
  };

  const dist = Math.abs(px - mx) + Math.abs(py - my);

  const doMelee = () => {
    // Priorite poison -> ensuite morsure (delai)
    const didPoison = tryBavePuante();
    delay(scene, didPoison ? 260 : 120, () => {
      tryMorsure();
      if (typeof onComplete === "function") onComplete();
    });
  };

  const doMoveThenActions = () => {
    if (pmRestants <= 0) {
      if (typeof onComplete === "function") onComplete();
      return;
    }

    const bfsPath =
      findPathToReachAdjacentToTarget(scene, map, mx, my, px, py, 60, monster) ||
      [];

    const pathTiles = bfsPath.length > 0 ? bfsPath.slice(0, pmRestants) : [];
    if (pathTiles.length === 0) {
      if (typeof onComplete === "function") onComplete();
      return;
    }

    moveMonsterAlongPath(scene, monster, map, groundLayer, pathTiles, () => {
      state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - pathTiles.length);
      if (pathTiles.length > 0) {
        showFloatingTextOverEntity(scene, monster, `${pathTiles.length}`, {
          color: "#22c55e",
        });
      }

      // Apres le deplacement : poison si possible, puis morsure si contact
      delay(scene, 520, () => {
        const didPoison = tryBavePuante();
        delay(scene, didPoison ? 260 : 140, () => {
          tryMorsure();
          if (typeof onComplete === "function") onComplete();
        });
      });
    });
  };

  // Si au contact, on joue "poison -> morsure"
  if (dist === 1) {
    doMelee();
    return;
  }

  // Si poison possible avant de bouger, on le lance puis on attend avant d'avancer
  const didPoison = tryBavePuante();
  if (didPoison) {
    delay(scene, 260, doMoveThenActions);
  } else {
    doMoveThenActions();
  }
}
