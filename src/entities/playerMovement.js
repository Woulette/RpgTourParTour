import { PLAYER_SPEED } from "../config/constants.js";
import {
  startPrep,
  limitPathForCombat,
  applyMoveCost,
  updateCombatPreview,
} from "../core/combat.js";
import {
  tryCastActiveSpellAtTile,
  getActiveSpell,
  clearActiveSpell,
  updateSpellRangePreview,
  clearSpellRangePreview,
} from "../core/spellSystem.js";

/**
 * Crée une fonction worldToTile "calibrée" qui compense
 * le léger décalage entre tileToWorldXY et worldToTileXY
 * sur la carte isométrique.
 */
function createCalibratedWorldToTile(map, groundLayer) {
  const testTileX = 0;
  const testTileY = 0;

  const worldPos = map.tileToWorldXY(
    testTileX,
    testTileY,
    undefined,
    undefined,
    groundLayer
  );
  const centerX = worldPos.x + map.tileWidth / 2;
  const centerY = worldPos.y + map.tileHeight / 2;

  // Ce que Phaser "pense" être la tuile à cette position
  const tF = groundLayer.worldToTileXY(centerX, centerY, false);

  let offsetX = 0;
  let offsetY = 0;
  if (tF) {
    // On enlève 0.5 car Phaser renvoie le centre de la tuile
    offsetX = tF.x - testTileX - 0.5;
    offsetY = tF.y - testTileY - 0.5;
  }

  return function worldToTile(worldX, worldY) {
    const raw = groundLayer.worldToTileXY(worldX, worldY, false);
    if (!raw) return null;

    return {
      x: Math.floor(raw.x - offsetX),
      y: Math.floor(raw.y - offsetY),
    };
  };
}

// Active le clic‑pour‑se‑déplacer et la prévisu de déplacement / sorts.
export function enableClickToMove(scene, player, hudY, map, groundLayer) {
  const worldToTile = createCalibratedWorldToTile(map, groundLayer);

  // Position de départ : on "snap" le joueur sur la tuile sous ses pieds
  const startTile = worldToTile(player.x, player.y);
  if (startTile && isValidTile(map, startTile.x, startTile.y)) {
    player.currentTileX = startTile.x;
    player.currentTileY = startTile.y;

    const worldPos = map.tileToWorldXY(
      startTile.x,
      startTile.y,
      undefined,
      undefined,
      groundLayer
    );

    player.x = worldPos.x + map.tileWidth / 2;
    player.y = worldPos.y + map.tileHeight / 2;
  }

  // --- PRÉVISU : déplacement (vert) + portée de sort (bleu) ---
  scene.input.on("pointermove", (pointer) => {
    // Pas de prévisu si la souris est sur le HUD
    if (pointer.y > hudY) {
      updateCombatPreview(scene, map, groundLayer, null);
      clearSpellRangePreview(scene);
      return;
    }

    const activeSpell = getActiveSpell(player);
    const state = scene.combatState;

    // Hors combat : aucune prévisu
    if (!state || !state.enCours) {
      updateCombatPreview(scene, map, groundLayer, null);
      clearSpellRangePreview(scene);
      return;
    }

    // Si un sort est sélectionné : on affiche uniquement la portée du sort
    if (activeSpell) {
      updateCombatPreview(scene, map, groundLayer, null);
      updateSpellRangePreview(scene, map, groundLayer, player, activeSpell);
      return;
    }

    // Pas de sort : prévisu de déplacement, on nettoie la zone de sort
    clearSpellRangePreview(scene);

    const t = worldToTile(pointer.worldX, pointer.worldY);
    if (!t) {
      updateCombatPreview(scene, map, groundLayer, null);
      return;
    }

    const tileX = t.x;
    const tileY = t.y;

    if (!isValidTile(map, tileX, tileY)) {
      updateCombatPreview(scene, map, groundLayer, null);
      return;
    }

    // En phase de préparation : uniquement les cases autorisées
    if (scene.prepState && scene.prepState.actif) {
      const allowed = scene.prepState.allowedTiles || [];
      const isAllowed = allowed.some(
        (tile) => tile.x === tileX && tile.y === tileY
      );
      if (!isAllowed) {
        updateCombatPreview(scene, map, groundLayer, null);
        return;
      }
    }

    // Chemin sans diagonales pour la prévisu en combat
    let path = calculatePath(
      player.currentTileX,
      player.currentTileY,
      tileX,
      tileY,
      false
    );

    if (!path || path.length === 0) {
      updateCombatPreview(scene, map, groundLayer, null);
      return;
    }

    const limited = limitPathForCombat(scene, player, path);
    if (!limited || !limited.path || limited.path.length === 0) {
      updateCombatPreview(scene, map, groundLayer, null);
      return;
    }

    updateCombatPreview(scene, map, groundLayer, limited.path);
  });

  // --- Clic pour déplacer ou lancer un sort ---
  scene.input.on("pointerdown", (pointer) => {
    const activeSpell = getActiveSpell(player);

    // Clic sur le HUD : si un sort était sélectionné, on l'annule
    // et on revient en mode déplacement.
    if (pointer.y > hudY) {
      if (activeSpell) {
        clearActiveSpell(player);
        updateCombatPreview(scene, map, groundLayer, null);
        clearSpellRangePreview(scene);
      }
      return;
    }

    // Stop mouvement en cours
    if (player.currentMoveTween) {
      player.currentMoveTween.stop();
      player.currentMoveTween = null;
      player.isMoving = false;
    }

    // Resynchronise la tuile courante à partir de la position actuelle
    updatePlayerTilePosition(player, worldToTile);

    const worldX = pointer.worldX;
    const worldY = pointer.worldY;

    const t = worldToTile(worldX, worldY);
    if (!t) return;

    let tileX = t.x;
    let tileY = t.y;

    if (!isValidTile(map, tileX, tileY)) return;

    // En phase de préparation : déplacement uniquement sur les cases autorisées
    if (scene.prepState && scene.prepState.actif) {
      const allowed = scene.prepState.allowedTiles || [];
      const isAllowed = allowed.some(
        (tile) => tile.x === tileX && tile.y === tileY
      );
      if (!isAllowed) {
        return;
      }
    }

    const state = scene.combatState;

    // Si un sort est sélectionné et qu'on est en combat,
    // on tente de lancer le sort sur cette tuile.
    if (state && state.enCours && activeSpell) {
      const cast = tryCastActiveSpellAtTile(
        scene,
        player,
        tileX,
        tileY,
        map,
        groundLayer
      );

      // Sort lancé avec succès : pas de déplacement pour ce clic.
      if (cast) {
        return;
      }

      // Sort impossible : on annule le sort, on nettoie et on ne bouge pas.
      clearActiveSpell(player);
      updateCombatPreview(scene, map, groundLayer, null);
      clearSpellRangePreview(scene);
      return;
    }

    // À partir d'ici, aucun sort n'est sélectionné : on gère le déplacement.
    // En combat, le joueur ne peut pas se déplacer sur une tuile occupée par un monstre.
    if (state && state.enCours && scene.monsters) {
      const occupied = scene.monsters.some(
        (m) =>
          typeof m.tileX === "number" &&
          typeof m.tileY === "number" &&
          m.tileX === tileX &&
          m.tileY === tileY
      );
      if (occupied) {
        return;
      }
    }

    // DEBUG : marque la tuile détectée
    const debugWorld = map.tileToWorldXY(
      tileX,
      tileY,
      undefined,
      undefined,
      groundLayer
    );
    const debugCX = debugWorld.x + map.tileWidth / 2;
    const debugCY = debugWorld.y + map.tileHeight / 2;
    const marker = scene.add.rectangle(debugCX, debugCY, 10, 10, 0xff0000, 0.7);
    if (scene.hudCamera) {
      scene.hudCamera.ignore(marker);
    }
    scene.time.delayedCall(200, () => marker.destroy());

    if (player.currentTileX === tileX && player.currentTileY === tileY) return;

    // Chemin brut : diagonales autorisées hors combat, interdites en combat
    const allowDiagonal =
      !(scene.combatState && scene.combatState.enCours);

    let path = calculatePath(
      player.currentTileX,
      player.currentTileY,
      tileX,
      tileY,
      allowDiagonal
    );

    if (!path || path.length === 0) {
      maybeStartPendingCombat(scene, player, map, groundLayer);
      return;
    }

    let moveCost = 0;

    // Si on est en combat, on laisse le module de combat décider
    // si le déplacement est autorisé et à quel coût en PM.
    if (state && state.enCours) {
      const limited = limitPathForCombat(scene, player, path);
      if (!limited || !limited.path || limited.path.length === 0) {
        return;
      }
      path = limited.path;
      moveCost = limited.moveCost;
    }

    movePlayerAlongPath(scene, player, map, groundLayer, path, moveCost);
  });
}

function updatePlayerTilePosition(player, worldToTile) {
  const t = worldToTile(player.x, player.y);
  if (!t) return;

  player.currentTileX = t.x;
  player.currentTileY = t.y;
}

function calculatePath(startX, startY, endX, endY, allowDiagonal = true) {
  const path = [];
  let currentX = startX;
  let currentY = startY;

  while (currentX !== endX || currentY !== endY) {
    const dx = endX - currentX;
    const dy = endY - currentY;

    let nextX = currentX;
    let nextY = currentY;

    if (allowDiagonal && dx !== 0 && dy !== 0) {
      // Diagonale
      nextX += dx > 0 ? 1 : -1;
      nextY += dy > 0 ? 1 : -1;
    } else if (dx !== 0) {
      // Horizontal
      nextX += dx > 0 ? 1 : -1;
    } else if (dy !== 0) {
      // Vertical
      nextY += dy > 0 ? 1 : -1;
    }

    path.push({ x: nextX, y: nextY });
    currentX = nextX;
    currentY = nextY;
  }

  return path;
}

function getDirectionName(dx, dy) {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx < 1e-3 && absDy < 1e-3) {
    return "south-east";
  }

  // Si le mouvement est principalement horizontal -> Est / Ouest
  if (absDx > absDy * 2) {
    return dx > 0 ? "east" : "west";
  }

  // Si le mouvement est principalement vertical -> Nord / Sud
  if (absDy > absDx * 2) {
    return dy > 0 ? "south" : "north";
  }

  // Sinon, on est sur une vraie diagonale -> NE / SE / SW / NW
  if (dx > 0 && dy < 0) return "north-east";
  if (dx > 0 && dy > 0) return "south-east";
  if (dx < 0 && dy > 0) return "south-west";
  return "north-west";
}

// Déplacement "manuel" vers une tuile cible (hors clic direct).
// Utilisé par exemple pour des scripts ou téléportations contrôlées.
export function movePlayerToTile(
  scene,
  player,
  map,
  groundLayer,
  tileX,
  tileY
) {
  if (!isValidTile(map, tileX, tileY)) return;

  if (
    typeof player.currentTileX !== "number" ||
    typeof player.currentTileY !== "number"
  ) {
    const raw = groundLayer.worldToTileXY(player.x, player.y, false);
    if (!raw) return;
    player.currentTileX = Math.floor(raw.x);
    player.currentTileY = Math.floor(raw.y);
  }

  const path = calculatePath(
    player.currentTileX,
    player.currentTileY,
    tileX,
    tileY,
    true
  );

  if (!path || path.length === 0) return;

  movePlayerAlongPath(scene, player, map, groundLayer, path, 0);
}

function movePlayerAlongPath(
  scene,
  player,
  map,
  groundLayer,
  path,
  moveCost = 0
) {
  if (path.length === 0) {
    player.isMoving = false;
    maybeStartPendingCombat(scene, player, map, groundLayer);
    return;
  }

  player.isMoving = true;
  const nextTile = path.shift();

  const worldPos = map.tileToWorldXY(
    nextTile.x,
    nextTile.y,
    undefined,
    undefined,
    groundLayer
  );

  const targetX = worldPos.x + map.tileWidth / 2;
  const targetY = worldPos.y + map.tileHeight / 2;

  const dxWorld = targetX - player.x;
  const dyWorld = targetY - player.y;
  const dir = getDirectionName(dxWorld, dyWorld);
  if (
    player.anims &&
    scene.anims &&
    scene.anims.exists &&
    scene.anims.exists(`player_run_${dir}`)
  ) {
    player.anims.play(`player_run_${dir}`, true);
  }

  const distance = Phaser.Math.Distance.Between(
    player.x,
    player.y,
    targetX,
    targetY
  );
  const duration = (distance / PLAYER_SPEED) * 1000;

  player.currentMoveTween = scene.tweens.add({
    targets: player,
    x: targetX,
    y: targetY,
    duration,
    ease: "Linear",
    onComplete: () => {
      player.x = targetX;
      player.y = targetY;
      player.currentTileX = nextTile.x;
      player.currentTileY = nextTile.y;

      if (path.length > 0) {
        movePlayerAlongPath(scene, player, map, groundLayer, path, moveCost);
      } else {
        player.isMoving = false;
        player.currentMoveTween = null;
        player.movePath = [];

        // Applique le coût de déplacement au système de combat (PM, HUD)
        applyMoveCost(scene, player, moveCost);

        maybeStartPendingCombat(scene, player, map, groundLayer);
        if (player.anims && player.anims.currentAnim) {
          player.anims.stop();
          player.setTexture("player");
        }
      }
    },
  });
}

// Si une cible de combat est en attente et que le joueur est sur sa case
// (ou très proche), on déclenche la phase de préparation.
function maybeStartPendingCombat(scene, player, map, groundLayer) {
  const target = scene.pendingCombatTarget;
  if (!target || !target.monsterId) return;

  // Si le monstre connaît ses coordonnées de tuile, on compare en tuiles
  const sameTile =
    typeof target.tileX === "number" &&
    typeof target.tileY === "number" &&
    player.currentTileX === target.tileX &&
    player.currentTileY === target.tileY;

  let closeEnough = false;
  if (!sameTile) {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist2 = dx * dx + dy * dy;
    closeEnough = dist2 < 4;
  }

  if (sameTile || closeEnough) {
    startPrep(scene, player, target, map, groundLayer);
    scene.pendingCombatTarget = null;
  }
}

function isValidTile(map, tileX, tileY) {
  return (
    tileX >= 0 &&
    tileX < map.width &&
    tileY >= 0 &&
    tileY < map.height
  );
}

