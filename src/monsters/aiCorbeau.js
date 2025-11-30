import { monsterSpells } from "../config/monsterSpells.js";
import { castSpellAtTile } from "../core/spellSystem.js";
import { moveMonsterAlongPath } from "./aiUtils.js";

// IA du corbeau : approche simple + coup de bec au corps à corps,
// avec fuite si ses PV tombent très bas.
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

  // Coordonnées de tuile du monstre
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

  // Distance actuelle joueur / corbeau en cases
  const distToPlayer = Math.abs(px - mx) + Math.abs(py - my);

  // Tente d'abord un coup de bec si on est déjà au corps à corps
  const corbeauSpells = monsterSpells.corbeau || {};
  const coupDeBec = corbeauSpells.coup_de_bec;

  const tryMeleeAttack = () => {
    if (!coupDeBec) return false;

    const stateNow = scene.combatState;
    if (!stateNow || !stateNow.enCours) return false;

    const ok = castSpellAtTile(
      scene,
      monster,
      coupDeBec,
      px,
      py,
      map,
      groundLayer
    );

    return ok;
  };

  // Si on est au cac et qu'on ne fuit pas, on essaye d'attaquer tout de suite
  if (!fleeing && distToPlayer === 1) {
    const attacked = tryMeleeAttack();
    if (attacked) {
      if (typeof onComplete === "function") onComplete();
      return;
    }
  }

  // On avance (ou recule) d'au plus pmRestants cases, sans diagonales
  while (pmRestants > 0) {
    const dx = px - mx;
    const dy = py - my;

    const dist = Math.abs(dx) + Math.abs(dy);

    // Approche : on s'arrête à 1 case du joueur (corps à corps)
    if (!fleeing && dist <= 1) break;

    let stepX = 0;
    let stepY = 0;

    if (Math.abs(dx) >= Math.abs(dy)) {
      stepX = dx === 0 ? 0 : Math.sign(dx);
    } else {
      stepY = dy === 0 ? 0 : Math.sign(dy);
    }

    if (fleeing) {
      stepX = -stepX;
      stepY = -stepY;
    }

    if (stepX === 0 && stepY === 0) break;

    const nextX = mx + stepX;
    const nextY = my + stepY;

    if (nextX < 0 || nextX >= map.width || nextY < 0 || nextY >= map.height) {
      break;
    }

    mx = nextX;
    my = nextY;
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

    if (scene.updateHudTargetInfo) {
      scene.updateHudTargetInfo(monster);
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

