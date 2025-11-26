import { passerTour } from "../core/combat.js";
import { PLAYER_SPEED } from "../config/constants.js";
import { monsterSpells } from "../config/monsterSpells.js";
import { castSpellAtTile } from "../core/spellSystem.js";

// IA des monstres en combat.
// Pour l'instant : logique spécifique au corbeau.

export function runMonsterTurn(scene) {
  const state = scene.combatState;
  if (!state || !state.enCours) return;

  const monster = state.monstre;
  const player = state.joueur;
  const map = scene.combatMap;
  const groundLayer = scene.combatGroundLayer;

  if (!monster || !player || !map || !groundLayer) return;

  // On passe officiellement au tour du monstre
  state.tour = "monstre";
  state.paRestants = state.paBaseMonstre;
  state.pmRestants = state.pmBaseMonstre;

  const lbl = document.getElementById("combat-turn-label");
  if (lbl) lbl.textContent = "Monstre";

  const finishTurn = () => {
    const newTurn = passerTour(scene);
    const turnLabel = document.getElementById("combat-turn-label");
    if (turnLabel) {
      turnLabel.textContent = newTurn === "monstre" ? "Monstre" : "Joueur";
    }
  };

  if (monster.monsterId === "corbeau") {
    runCorbeauTurn(scene, state, monster, player, map, groundLayer, finishTurn);
  } else {
    finishTurn();
  }
}

function runCorbeauTurn(
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

    // On vérifie la portée et les PA via spellSystem
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
      // L'attaque consomme des PA ; on termine ensuite le tour
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

  // Déplacement fluide case par case en chaînant les tweens
  moveMonsterAlongPath(scene, monster, map, groundLayer, pathTiles, () => {
    state.pmRestants = Math.max(0, state.pmRestants - stepsUsed);

    if (scene.updateHudTargetInfo) {
      scene.updateHudTargetInfo(monster);
    }

    // Après le déplacement, on recalcule la distance au joueur.
    // S'il est maintenant au cac et qu'il ne fuit pas, on tente le sort.
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

function moveMonsterAlongPath(scene, monster, map, groundLayer, path, onDone) {
  if (!path || path.length === 0) {
    if (typeof onDone === "function") onDone();
    return;
  }

  const next = path.shift();
  const worldPos = map.tileToWorldXY(
    next.x,
    next.y,
    undefined,
    undefined,
    groundLayer
  );
  const targetX = worldPos.x + map.tileWidth / 2;
  const targetY = worldPos.y + map.tileHeight / 2;

  const dist = Phaser.Math.Distance.Between(
    monster.x,
    monster.y,
    targetX,
    targetY
  );
  const duration = (dist / PLAYER_SPEED) * 1000;

  scene.tweens.add({
    targets: monster,
    x: targetX,
    y: targetY,
    duration,
    ease: "Linear",
    onComplete: () => {
      monster.x = targetX;
      monster.y = targetY;
      monster.tileX = next.x;
      monster.tileY = next.y;

      if (path.length > 0) {
        moveMonsterAlongPath(scene, monster, map, groundLayer, path, onDone);
      } else if (typeof onDone === "function") {
        onDone();
      }
    },
  });
}

