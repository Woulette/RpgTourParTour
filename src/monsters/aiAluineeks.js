import { monsterSpells } from "../config/monsterSpells.js";
import {
  castSpellAtTile,
  isSpellInRangeFromPosition,
  canCastSpellOnTile,
} from "../core/spellSystem.js";
import { showFloatingTextOverEntity } from "../core/combat/floatingText.js";
import {
  delay,
  moveMonsterAlongPath,
  isTileOccupiedByMonster,
} from "./aiUtils.js";

// IA d'Aluineeks :
// - ne recule jamais (ne s'eloigne pas du joueur volontairement)
// - cherche a se mettre en ligne a 1–2 cases pour lancer Fissure
// - peut lancer Fissure jusqu'a 2 fois avec un petit delai entre les deux
export function runTurn(
  scene,
  state,
  monster,
  player,
  map,
  groundLayer,
  onComplete
) {
  let pmRestants = state.pmRestants ?? 0;

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

  let mx = monster.tileX ?? 0;
  let my = monster.tileY ?? 0;

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

  const aluSpells = monsterSpells.aluineeks || {};
  const fissure = aluSpells.fissure;

  const isInFissureRange = (tx, ty) => {
    if (!fissure) return false;
    return isSpellInRangeFromPosition(fissure, tx, ty, px, py);
  };
  

  const tryCastFissure = () => {
    if (!fissure) return false;
    const stateNow = scene.combatState;
    if (!stateNow || !stateNow.enCours) return false;
  
    const canHit = canCastSpellOnTile(
      scene,
      monster,
      fissure,
      px,
      py,
      map
    );
    if (!canHit) return false;
  
    return castSpellAtTile(
      scene,
      monster,
      fissure,
      px,
      py,
      map,
      groundLayer
    );
  };  

  const pathTiles = [];

  // 1) Cherche une case cible "ideale" a 1–2 cases en ligne du joueur,
  //    atteignable avec les PM disponibles.
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
    if (
      c.x < 0 ||
      c.x >= map.width ||
      c.y < 0 ||
      c.y >= map.height
    ) {
      continue;
    }
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
    // Construit un chemin simple vers la case cible sans depasser les PM
    let cx = mx;
    let cy = my;
    while (
      (cx !== bestTarget.x || cy !== bestTarget.y) &&
      pathTiles.length < pmRestants
    ) {
      const dx = bestTarget.x - cx;
      const dy = bestTarget.y - cy;
      let stepX = 0;
      let stepY = 0;

      if (Math.abs(dx) >= Math.abs(dy)) {
        stepX = dx === 0 ? 0 : Math.sign(dx);
      } else {
        stepY = dy === 0 ? 0 : Math.sign(dy);
      }

      if (stepX === 0 && stepY === 0) break;

      const nextX = cx + stepX;
      const nextY = cy + stepY;

      if (
        nextX < 0 ||
        nextX >= map.width ||
        nextY < 0 ||
        nextY >= map.height
      ) {
        break;
      }

      // Ne pas marcher sur un autre monstre
      if (isTileOccupiedByMonster(scene, nextX, nextY, monster)) {
        break;
      }

      cx = nextX;
      cy = nextY;
      pathTiles.push({ x: cx, y: cy });
    }

    // Mets a jour la position "virtuelle" apres chemin
    if (pathTiles.length > 0) {
      const last = pathTiles[pathTiles.length - 1];
      mx = last.x;
      my = last.y;
    }
  } else {
    // 2) Pas de cible alignable atteignable: mouvement de fallback
    while (pmRestants > 0 && !isInFissureRange(mx, my)) {
      const dx = px - mx;
      const dy = py - my;
      const dist = Math.abs(dx) + Math.abs(dy);

      let stepX = 0;
      let stepY = 0;

      if (Math.abs(dx) >= Math.abs(dy)) {
        stepX = dx === 0 ? 0 : Math.sign(dx);
      } else {
        stepY = dy === 0 ? 0 : Math.sign(dy);
      }

      if (stepX === 0 && stepY === 0) break;

      const nextX = mx + stepX;
      const nextY = my + stepY;

      if (
        nextX < 0 ||
        nextX >= map.width ||
        nextY < 0 ||
        nextY >= map.height
      ) {
        break;
      }

      // Ne pas marcher sur un autre monstre
      if (isTileOccupiedByMonster(scene, nextX, nextY, monster)) {
        break;
      }

      const newDist = Math.abs(px - nextX) + Math.abs(py - nextY);
      if (newDist > dist) {
        // On ne s'eloigne jamais volontairement
        break;
      }

      mx = nextX;
      my = nextY;
      pmRestants -= 1;
      pathTiles.push({ x: mx, y: my });
    }
  }

  const afterMoveAndCast = (moved) => {
    // Mets a jour les PM restants
    state.pmRestants = Math.max(0, state.pmRestants - pathTiles.length);
    if (pathTiles.length > 0) {
      showFloatingTextOverEntity(scene, monster, `${pathTiles.length}`, {
        color: "#22c55e",
      });
    }

    // Enchaine jusqu'a 2 lancers de Fissure avec un delai,
    // pour que les degats visuels aient le temps d'apparaitre.
    const castSequence = (castIndex) => {
      const stateNow = scene.combatState;
      if (!stateNow || !stateNow.enCours) {
        if (typeof onComplete === "function") onComplete();
        return;
      }

      if (castIndex >= 2) {
        if (typeof onComplete === "function") onComplete();
        return;
      }

      if (!isInFissureRange(monster.tileX ?? mx, monster.tileY ?? my)) {
        if (typeof onComplete === "function") onComplete();
        return;
      }

      const ok = tryCastFissure();
      if (!ok) {
        if (typeof onComplete === "function") onComplete();
        return;
      }

      if (scene.time && scene.time.delayedCall) {
        scene.time.delayedCall(500, () => castSequence(castIndex + 1));
      } else {
        castSequence(castIndex + 1);
      }
    };

    delay(scene, moved ? 520 : 260, () => castSequence(0));
  };

  if (pathTiles.length === 0) {
    // Pas de deplacement (ou deja a portee) -> juste tenter le sort
    delay(scene, 160, () => afterMoveAndCast(false));
    return;
  }

  moveMonsterAlongPath(
    scene,
    monster,
    map,
    groundLayer,
    pathTiles,
    () => afterMoveAndCast(true)
  );
}
