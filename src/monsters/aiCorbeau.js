import { monsterSpells } from "../config/monsterSpells.js";
import {
  castSpellAtTile,
  canCastSpellOnTile,
} from "../core/spellSystem.js";
import { showFloatingTextOverEntity } from "../core/combat/floatingText.js";
import {
  delay,
  moveMonsterAlongPath,
  findPathToReachAdjacentToTarget,
  chooseStepTowardsTarget,
} from "./aiUtils.js";

// IA du corbeau : approche simple + coup de bec au corps a corps,
// avec fuite si ses PV tombent tres bas.
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
  if (pmRestants <= 0) {
    if (typeof onComplete === "function") onComplete();
    return;
  }

  // Coordonnees de tuile du monstre
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

  // Fuite si < 10% de PV, sinon approche
  const stats = monster.stats || {};
  const hp = stats.hp ?? stats.hpMax ?? 0;
  const hpMax = stats.hpMax || 1;
  const ratio = hp / hpMax;
  const fleeing = ratio < 0.1;

  let stepsUsed = 0;
  const pathTiles = [];

  // Tente d'abord un coup de bec si on est deja au corps a corps
  const corbeauSpells = monsterSpells.corbeau || {};
  const coupDeBec = corbeauSpells.coup_de_bec;
  
  const tryMeleeAttack = () => {
    if (!coupDeBec) return false;
  
    const stateNow = scene.combatState;
    if (!stateNow || !stateNow.enCours) return false;
  
    // Vérifie toutes les conditions via spellSystem (PA, tour, portée, etc.)
    const canHit = canCastSpellOnTile(
      scene,
      monster,
      coupDeBec,
      px,
      py,
      map
    );
    if (!canHit) return false;
  
    return castSpellAtTile(
      scene,
      monster,
      coupDeBec,
      px,
      py,
      map,
      groundLayer
    );
  };
  
  // Si on peut frapper (et qu'on ne fuit pas), on essaye d'attaquer tout de suite
  if (!fleeing) {
    const attacked = tryMeleeAttack();
    if (attacked) {
      if (typeof onComplete === "function") onComplete();
      return;
    }
  }  

  // Nouveau d��placement : on cherche un chemin vers une case de corps
  // �� corps libre autour du joueur, en ��vitant les autres monstres,
  // puis on ne consomme que pmRestants cases de ce chemin.
  const bfsPath =
    findPathToReachAdjacentToTarget(
      scene,
      map,
      mx,
      my,
      px,
      py,
      50,
      monster
    ) || [];

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
    if (typeof onComplete === "function") onComplete();
    return;
  }

  moveMonsterAlongPath(scene, monster, map, groundLayer, pathTiles, () => {
    state.pmRestants = Math.max(0, state.pmRestants - stepsUsed);
    if (stepsUsed > 0) {
      showFloatingTextOverEntity(scene, monster, `${stepsUsed}`, {
        color: "#22c55e",
      });
    }

    const finalMx = monster.tileX ?? mx;
    const finalMy = monster.tileY ?? my;
    const distAfterMove =
      Math.abs(px - finalMx) + Math.abs(py - finalMy);

    delay(scene, 520, () => {
      if (!fleeing && distAfterMove === 1) {
        tryMeleeAttack();
      }
      delay(scene, 140, () => {
        if (typeof onComplete === "function") onComplete();
      });
    });
  });

  return;

  // On avance (ou recule) d'au plus pmRestants cases, sans diagonales.
  // Le choix de la prochaine case est délégué à l'IA globale (contournement, alliés, etc.).
  while (pmRestants > 0) {
    const dist = Math.abs(px - mx) + Math.abs(py - my);

    // Approche : on s'arrête à 1 case du joueur (corps à corps)
    if (!fleeing && dist <= 1) break;

    const chosen = chooseStepTowardsTarget(
      scene,
      map,
      monster,
      mx,
      my,
      px,
      py,
      fleeing
    );

    if (!chosen) {
      // Aucun mouvement possible qui respecte la grille et evite les allies
      break;
    }

    mx = chosen.x;
    my = chosen.y;
    pmRestants -= 1;
    stepsUsed += 1;
    pathTiles.push({ x: mx, y: my });
  }

  if (stepsUsed === 0 || pathTiles.length === 0) {
    if (typeof onComplete === "function") onComplete();
    return;
  }

  moveMonsterAlongPath(scene, monster, map, groundLayer, pathTiles, () => {
    state.pmRestants = Math.max(0, state.pmRestants - stepsUsed);
    if (stepsUsed > 0) {
      showFloatingTextOverEntity(scene, monster, `${stepsUsed}`, {
        color: "#22c55e",
      });
    }

    const finalMx = monster.tileX ?? mx;
    const finalMy = monster.tileY ?? my;
    const distAfterMove =
      Math.abs(px - finalMx) + Math.abs(py - finalMy);

    if (!fleeing && distAfterMove === 1) {
      tryMeleeAttack();
    }

    if (typeof onComplete === "function") onComplete();
  });
}
