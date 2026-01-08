import { GAME_WIDTH } from "../config/constants.js";
import { startPrep } from "../features/combat/runtime/prep.js";
import {
  limitPathForCombat,
  updateCombatPreview,
} from "../features/combat/runtime/movement.js";
import { applyTaclePenalty, getTaclePenaltyPreview } from "../features/combat/runtime/tacle.js";
import {
  tryCastActiveSpellAtTile,
  getActiveSpell,
  clearActiveSpell,
  updateSpellRangePreview,
  clearSpellRangePreview,
} from "../features/combat/spells/index.js";
import { findExitTileForDirection } from "../features/maps/world.js";
import { findPathForPlayer } from "./movement/pathfinding.js";
import { movePlayerAlongPath } from "./movement/runtime.js";
import { isTileBlocked } from "../collision/collisionGrid.js";
import { on as onStoreEvent } from "../state/store.js";
import { isUiBlockingOpen } from "../features/ui/uiBlock.js";
import { getNetClient, getNetPlayerId } from "../app/session.js";

/**
 * Cre une fonction worldToTile "calibre" qui compense
 * le lger dcalage entre tileToWorldXY et worldToTileXY
 * sur la carte isomtrique.
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

  // Ce que Phaser "pense" tre la tuile a cette position
  const tF = groundLayer.worldToTileXY(centerX, centerY, false);

  let offsetX = 0;
  let offsetY = 0;
  if (tF) {
    // On enlve 0.5 car Phaser renvoie le centre de la tuile
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

// Active le clic pour se dplacer et la prvisu de dplacement / sorts.
 export function enableClickToMove(scene, player, hudY, map, groundLayer) {
  const worldToTile = createCalibratedWorldToTile(map, groundLayer);

  const refreshSpellPreviewFromPointer = () => {
    if (!scene || !scene.input) return;
    const pointer = scene.input.activePointer;
    if (!pointer) return;

    // Mme logique que le pointermove, mais dclenche sur changement de sort.
    if (pointer.y > hudY) {
      const hudTile = scene.__combatHudHoverSpellTile;
      const activeSpellHud = getActiveSpell(player);
      const stateHud = scene.combatState;

      if (
        stateHud &&
        stateHud.enCours &&
        activeSpellHud &&
        scene.__combatHudHoverLock &&
        hudTile &&
        typeof hudTile.x === "number" &&
        typeof hudTile.y === "number"
      ) {
        updateCombatPreview(scene, map, groundLayer, null);
        const mapForPreview = scene.combatMap || map;
        const layerForPreview = scene.combatGroundLayer || groundLayer;
        updateSpellRangePreview(
          scene,
          mapForPreview,
          layerForPreview,
          player,
          activeSpellHud,
          hudTile.x,
          hudTile.y
        );
        return;
      }

      updateCombatPreview(scene, map, groundLayer, null);
      clearSpellRangePreview(scene);
      return;
    }

    const activeSpell = getActiveSpell(player);
    const state = scene.combatState;
    if (!state || !state.enCours) {
      updateCombatPreview(scene, map, groundLayer, null);
      clearSpellRangePreview(scene);
      return;
    }

    if (activeSpell) {
      updateCombatPreview(scene, map, groundLayer, null);
      const t = worldToTile(pointer.worldX, pointer.worldY);
      const mapForPreview = scene.combatMap || map;
      const layerForPreview = scene.combatGroundLayer || groundLayer;
      updateSpellRangePreview(
        scene,
        mapForPreview,
        layerForPreview,
        player,
        activeSpell,
        t ? t.x : null,
        t ? t.y : null
      );
      return;
    }

    clearSpellRangePreview(scene);
    updateCombatPreview(scene, map, groundLayer, null);
  };

  // Rafrachit la prvisualisation immdiatement quand le sort actif change
  if (scene.__unsubscribeSpellPreview) {
    scene.__unsubscribeSpellPreview();
    scene.__unsubscribeSpellPreview = null;
  }
  scene.__unsubscribeSpellPreview = onStoreEvent(
    "spell:activeSpellChanged",
    (payload) => {
      if (!payload || payload.caster !== player) return;
      refreshSpellPreviewFromPointer();

      // Si la souris est dja sur un monstre, on rafrachit aussi la bulle + dgots
      // sans exiger un mouvement de souris.
      const hovered = scene.__combatTileHoverEntity;
      if (
        hovered &&
        hovered.monsterId &&
        scene.combatState &&
        scene.combatState.enCours &&
        typeof scene.showDamagePreview === "function" &&
        typeof scene.showMonsterTooltip === "function"
      ) {
        scene.showDamagePreview(hovered);
        scene.showMonsterTooltip(hovered);
      }
    }
  );

  // Position de dpart : on "snap" le joueur sur la tuile sous ses pieds
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

  // --- PReVISU : dplacement (vert) + porte de sort (bleu) ---
  scene.input.on("pointermove", (pointer) => {
    // Pas de prvisu si la souris est sur le HUD
    if (pointer.y > hudY) {
      const hudTile = scene.__combatHudHoverSpellTile;
      const activeSpellHud = getActiveSpell(player);
      const stateHud = scene.combatState;

      // Survol d'un portrait (ordre de tour) : on veut quand mcme voir la prcvisu du sort sur la tuile du monstre.
      if (
        stateHud &&
        stateHud.enCours &&
        activeSpellHud &&
        scene.__combatHudHoverLock &&
        hudTile &&
        typeof hudTile.x === "number" &&
        typeof hudTile.y === "number"
      ) {
        updateCombatPreview(scene, map, groundLayer, null);
        const mapForPreview = scene.combatMap || map;
        const layerForPreview = scene.combatGroundLayer || groundLayer;
        updateSpellRangePreview(
          scene,
          mapForPreview,
          layerForPreview,
          player,
          activeSpellHud,
          hudTile.x,
          hudTile.y
        );
        return;
      }

      updateCombatPreview(scene, map, groundLayer, null);
      clearSpellRangePreview(scene);
      return;
    }

    const activeSpell = getActiveSpell(player);
    const state = scene.combatState;

    // Hors combat : aucune prvisu
    if (!state || !state.enCours) {
      updateCombatPreview(scene, map, groundLayer, null);
      clearSpellRangePreview(scene);
      return;
    }

    // Si un sort est slectionn : on affiche la porte + la zone (si applicable)
    if (activeSpell) {
      updateCombatPreview(scene, map, groundLayer, null);
      const t = worldToTile(pointer.worldX, pointer.worldY);
      const mapForPreview = scene.combatMap || map;
      const layerForPreview = scene.combatGroundLayer || groundLayer;
      updateSpellRangePreview(
        scene,
        mapForPreview,
        layerForPreview,
        player,
        activeSpell,
        t ? t.x : null,
        t ? t.y : null
      );
      return;
    }

    // Pas de sort : prvisu de dplacement, on nettoie la zone de sort
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

    // En phase de prparation : uniquement les cases autorises
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

    // Chemin sans diagonales pour la prvisu en combat
    let path = findPathForPlayer(
      scene,
      map,
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

      updateCombatPreview(scene, map, groundLayer, path);
    });

  // --- Clic pour dplacer ou lancer un sort ---
  scene.input.on("pointerdown", (pointer) => {
    if (window.__uiPointerBlock) {
      return;
    }
    if (isUiBlockingOpen()) {
      return;
    }
    const netClient = getNetClient();
    const netPlayerId = getNetPlayerId();

    const activeSpell = getActiveSpell(player);
    const bandWidthRight = 30;
    const bandWidthLeft = 30;
    const bandHeightTop = 30;
    const bandHeightBottom = 30;

    // Clic sur le HUD : si un sort tait slectionn, on l'annule
    // et on revient en mode dplacement.
    if (pointer.y > hudY) {
      if (activeSpell) {
        clearActiveSpell(player);
        updateCombatPreview(scene, map, groundLayer, null);
        clearSpellRangePreview(scene);
      }
      return;
    }

    // Pas de nouveau dplacement pendant une rcolte.
    if (
      player.isHarvestingTree ||
      player.isHarvestingHerb ||
      player.isHarvestingWell
    ) {
      return;
    }

    // En combat : tant que ce n'est pas au tour du joueur, aucune action (ni dplacement, ni cast).
    // Mais la slection/prvisualisation du sort reste possible via le HUD / touches.
    const stateForTurn = scene.combatState;
    if (stateForTurn && stateForTurn.enCours) {
      if (stateForTurn.tour !== "joueur") {
        return;
      }
      if (
        Number.isInteger(stateForTurn.activePlayerId) &&
        getNetPlayerId() !== stateForTurn.activePlayerId
      ) {
        return;
      }
    }

    // En combat : pas d'action pendant un dcplacement (sinon on peut dcpasser PM/PA).
    if (
      scene.combatState &&
      scene.combatState.enCours &&
      (player.isMoving || player.currentMoveTween)
    ) {
      return;
    }

    // Resynchronise la tuile courante a partir de la position actuelle
    updatePlayerTilePosition(player, worldToTile);

    // Si on clique sur un monstre, on utilise sa tuile
    // plutt que la tuile "derrire" dtecte par le clic.
    let clickedMonster = null;
    if (
      // On ignore la hitbox des monstres en combat et en prparation
      // (les sprites dbordent sur d'autres cases, a gne le placement / ciblage).
      !(scene.combatState && scene.combatState.enCours) &&
      !(scene.prepState && scene.prepState.actif) &&
      scene.monsters &&
      scene.monsters.length > 0
    ) {
      const worldXForHit = pointer.worldX;
      const worldYForHit = pointer.worldY;
      clickedMonster = scene.monsters.find((m) => {
        if (!m || !m.getBounds) return false;
        const bounds = m.getBounds();
        return bounds.contains(worldXForHit, worldYForHit);
      });
    }

    const worldX = pointer.worldX;
    const worldY = pointer.worldY;

    let tileX;
    let tileY;

    if (
      clickedMonster &&
      typeof clickedMonster.tileX === "number" &&
      typeof clickedMonster.tileY === "number"
    ) {
      // Clic directement sur le monstre : on vise sa tuile exacte
      tileX = clickedMonster.tileX;
      tileY = clickedMonster.tileY;
    } else {
      const t = worldToTile(worldX, worldY);
      if (!t) return;
      tileX = t.x;
      tileY = t.y;
    }

    if (!isValidTile(map, tileX, tileY)) return;

    // Collision logique : si la tuile est bloque, on vise la tuile libre la plus proche
    // (sauf si un sort est actif en combat : on veut pouvoir cibler un monstre).
    if (isTileBlocked(scene, tileX, tileY)) {
      const inCombat =
        scene.combatState && scene.combatState.enCours;
      if (!(inCombat && activeSpell)) {
        const allowDiagonal = !inCombat;
        const nearest = findNearestReachableTile(
          scene,
          map,
          player.currentTileX,
          player.currentTileY,
          tileX,
          tileY,
          allowDiagonal
        );
        if (!nearest) {
          return;
        }
        tileX = nearest.x;
        tileY = nearest.y;
      }
    }

    const state = scene.combatState;

    // Intention de sortie de map (hors combat uniquement).
    const inCombat = state && state.enCours;
    if (!inCombat) {
      const clickedInRightBand = pointer.x >= GAME_WIDTH - bandWidthRight;
      const clickedInLeftBand = pointer.x <= bandWidthLeft;
      const clickedInTopBand = pointer.y <= bandHeightTop;
      const clickedInBottomBand =
        pointer.y >= hudY - bandHeightBottom && pointer.y < hudY;
      const exits = scene.worldExits || {};

      if (clickedInRightBand && exits.right && exits.right.length > 0) {
        // Sortie a droite : tuile de sortie la plus proche verticalement
        let best = null;
        let bestDy = Infinity;
        exits.right.forEach((tile) => {
          const dy = Math.abs(tile.y - tileY);
          if (dy < bestDy) {
            bestDy = dy;
            best = tile;
          }
        });

        if (best) {
          tileX = best.x;
          tileY = best.y;
          scene.exitDirection = "right";
          scene.exitTargetTile = { x: tileX, y: tileY };
        }
      } else if (clickedInLeftBand && exits.left && exits.left.length > 0) {
        // Sortie a gauche : tuile de sortie la plus proche verticalement
        let best = null;
        let bestDy = Infinity;
        exits.left.forEach((tile) => {
          const dy = Math.abs(tile.y - tileY);
          if (dy < bestDy) {
            bestDy = dy;
            best = tile;
          }
        });

        if (best) {
          tileX = best.x;
          tileY = best.y;
          scene.exitDirection = "left";
          scene.exitTargetTile = { x: tileX, y: tileY };
        }
      } else if (clickedInTopBand && exits.up && exits.up.length > 0) {
        // Sortie vers le haut : tuile la plus proche du clic en X
        let best = null;
        let bestDx = Infinity;

        exits.up.forEach((tile) => {
          const wp = map.tileToWorldXY(
            tile.x,
            tile.y,
            undefined,
            undefined,
            groundLayer
          );
          const cx = wp.x + map.tileWidth / 2;
          const dx = Math.abs(pointer.worldX - cx);

          if (dx < bestDx) {
            bestDx = dx;
            best = tile;
          }
        });

        if (best) {
          tileX = best.x;
          tileY = best.y;
          scene.exitDirection = "up";
          scene.exitTargetTile = { x: tileX, y: tileY };
        }
      } else if (clickedInBottomBand && exits.down && exits.down.length > 0) {
        // Sortie vers le bas : tuile la plus proche du clic en X
        let best = null;
        let bestDx = Infinity;

        exits.down.forEach((tile) => {
          const wp = map.tileToWorldXY(
            tile.x,
            tile.y,
            undefined,
            undefined,
            groundLayer
          );
          const cx = wp.x + map.tileWidth / 2;
          const dx = Math.abs(pointer.worldX - cx);

          if (dx < bestDx) {
            bestDx = dx;
            best = tile;
          }
        });

        if (best) {
          tileX = best.x;
          tileY = best.y;
          scene.exitDirection = "down";
          scene.exitTargetTile = { x: tileX, y: tileY };
        }
      } else {
        // Clic normal : on annule une ventuelle sortie en attente.
        scene.exitDirection = null;
        scene.exitTargetTile = null;
      }
    }

    // En phase de prparation : dplacement uniquement sur les cases autorises
    if (scene.prepState && scene.prepState.actif) {
      const allowed = scene.prepState.allowedTiles || [];
      const isAllowed = allowed.some(
        (tile) => tile.x === tileX && tile.y === tileY
      );
      if (!isAllowed) {
        return;
      }
    }

    // Si un sort est slectionn et qu'on est en combat,
    // on tente de lancer le sort sur cette tuile.
    if (state && state.enCours && activeSpell) {
      const mapForCast = scene.combatMap || map;
      const layerForCast = scene.combatGroundLayer || groundLayer;
      const cast = tryCastActiveSpellAtTile(
        scene,
        player,
        tileX,
        tileY,
        mapForCast,
        layerForCast
      );

      // Sort lanc avec succs : pas de dplacement pour ce clic.
      if (cast) {
        return;
      }

      // Sort impossible : on annule le sort, on nettoie et on ne bouge pas.
      clearActiveSpell(player);
      updateCombatPreview(scene, map, groundLayer, null);
      clearSpellRangePreview(scene);
      return;
    }

    // C partir d'ici, aucun sort n'est slectionn : on gre le dplacement.
    // En combat, le joueur ne peut pas se dplacer sur une tuile occupe par un monstre.
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

    if (player.currentTileX === tileX && player.currentTileY === tileY) return;

    // Chemin brut : diagonales autorises hors combat, interdites en combat
    const allowDiagonal = !(scene.combatState && scene.combatState.enCours);

    let path = findPathForPlayer(
      scene,
      map,
      player.currentTileX,
      player.currentTileY,
      tileX,
      tileY,
      allowDiagonal
    );

    if (!path || path.length === 0) {
      // Si on n'a aucun chemin, on ne dclenche rien (ni combat, ni sortie).
      return;
    }

    let moveCost = 0;

    // Si on est en combat, on laisse le module de combat dcider
    // si le dplacement est autoris et a quel cot en PM.
      if (state && state.enCours) {
        if (path.length > (state.pmRestants ?? 0)) {
          return;
        }
        const limited = limitPathForCombat(scene, player, path);
        if (!limited || !limited.path || limited.path.length === 0) {
          return;
        }
        path = limited.path;
        moveCost = limited.moveCost;
        const lastStep = path[path.length - 1];
        if (lastStep && Number.isInteger(lastStep.x) && Number.isInteger(lastStep.y)) {
          tileX = lastStep.x;
          tileY = lastStep.y;
        }
      }

      if (scene.prepState && scene.prepState.actif && netClient && netPlayerId) {
        netClient.sendCmd("CmdCombatPlacement", {
          playerId: netPlayerId,
          combatId: scene.__lanCombatId ?? null,
          mapId: scene.currentMapKey || scene.currentMapDef?.key || null,
          tileX,
          tileY,
          classId: typeof player?.classId === "string" ? player.classId : null,
          displayName:
            typeof player?.displayName === "string" ? player.displayName : null,
        });
        movePlayerAlongPathWithCombat(
          scene,
          player,
          map,
          groundLayer,
          path,
          0
        );
        return;
      }

      if (netClient && netPlayerId) {
        if (state && state.enCours && state.joueur === player) {
          applyTaclePenalty(scene, player);
        }
        const now = Date.now();
        const lastAt = player.__lanLastCmdAt || 0;
        if (now - lastAt < 150) {
          return;
        }
      const lastTarget = player.__lanLastTarget || null;
      if (lastTarget && lastTarget.x === tileX && lastTarget.y === tileY) {
        return;
      }
      player.__lanLastCmdAt = now;
      player.__lanLastTarget = { x: tileX, y: tileY };
      if (player.currentMoveTween) {
        player.currentMoveTween.stop();
        player.currentMoveTween = null;
        player.isMoving = false;
        if (player.anims && player.anims.currentAnim) {
          player.anims.stop();
          const animPrefix = player.animPrefix || "player";
          const idleKey = `${animPrefix}_idle_${player.lastDirection || "south-east"}`;
          if (scene.textures?.exists && scene.textures.exists(idleKey)) {
            player.setTexture(idleKey);
          } else {
            player.setTexture(player.baseTextureKey || animPrefix);
          }
        }
      }
      const safePath = path.map((step) => ({ x: step.x, y: step.y }));
      const inCombatMove =
        (state && state.enCours) || (scene.prepState && scene.prepState.actif);
      if (inCombatMove) {
        player.__lanCombatMoveSeq = (player.__lanCombatMoveSeq || 0) + 1;
        netClient.sendCmd("CmdMoveCombat", {
          playerId: netPlayerId,
          combatId: scene.__lanCombatId ?? null,
          mapId: scene.currentMapKey || scene.currentMapDef?.key || null,
          seq: player.__lanCombatMoveSeq,
          path: safePath,
          toX: tileX,
          toY: tileY,
          moveCost,
        });
      } else {
        player.__lanMoveSeq = (player.__lanMoveSeq || 0) + 1;
        netClient.sendCmd("CmdMove", {
          playerId: netPlayerId,
          seq: player.__lanMoveSeq,
          path: safePath,
          toX: tileX,
          toY: tileY,
        });
      }
      return;
    }

    if (player.currentMoveTween) {
      player.currentMoveTween.stop();
      player.currentMoveTween = null;
      player.isMoving = false;
      if (player.anims && player.anims.currentAnim) {
        player.anims.stop();
        const animPrefix = player.animPrefix || "player";
        const idleKey = `${animPrefix}_idle_${player.lastDirection || "south-east"}`;
        if (scene.textures?.exists && scene.textures.exists(idleKey)) {
          player.setTexture(idleKey);
        } else {
          player.setTexture(player.baseTextureKey || animPrefix);
        }
      }
    }

    movePlayerAlongPathWithCombat(
      scene,
      player,
      map,
      groundLayer,
      path,
      moveCost
    );
  });
}

function updatePlayerTilePosition(player, worldToTile) {
  const t = worldToTile(player.x, player.y);
  if (!t) return;

  player.currentTileX = t.x;
  player.currentTileY = t.y;
}

// Wrapper autour du mouvement runtime : excute le dplacement puis,
// une fois le chemin termin, vrifie si un combat doit dmarrer
// et laisse world.js grer la sortie de map via maybeHandleMapExit.
function movePlayerAlongPathWithCombat(
  scene,
  player,
  map,
  groundLayer,
  path,
  moveCost
) {
  if (scene?.combatState?.enCours) {
    const preview = getTaclePenaltyPreview(scene, player);
    if (preview.malusPct >= 1) {
      return;
    }
    applyTaclePenalty(scene, player);
    const pmRestants = scene.combatState.pmRestants ?? 0;
    if (path.length > pmRestants) {
      path = path.slice(0, pmRestants);
      moveCost = path.length;
    }
    if (moveCost <= 0) {
      return;
    }
  }
  movePlayerAlongPath(
    scene,
    player,
    map,
    groundLayer,
    path,
    moveCost,
    () => {
      maybeStartPendingCombat(scene, player, map, groundLayer);
    }
  );
}

// Mouvement venant du reseau : on reutilise le flux standard pour garder
// les triggers (combat, sorties de map) identiques au solo.
export function movePlayerAlongPathNetwork(scene, player, map, groundLayer, path) {
  if (!path || path.length === 0) return;
  movePlayerAlongPathWithCombat(scene, player, map, groundLayer, path, 0);
}

export function movePlayerAlongPathNetworkCombat(
  scene,
  player,
  map,
  groundLayer,
  path,
  moveCost
) {
  if (!path || path.length === 0) return;
  const cost = Number.isFinite(moveCost) ? moveCost : 0;
  movePlayerAlongPath(scene, player, map, groundLayer, path, cost);
}

// Si une cible de combat est en attente et que le joueur est sur sa case
// (ou trs proche), on dclenche la phase de prparation.
function maybeStartPendingCombat(scene, player, map, groundLayer) {
  const target = scene.pendingCombatTarget;
  if (!target || !target.monsterId) return;

  // Si le monstre connat ses coordonnes de tuile, on compare en tuiles
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
  return tileX >= 0 && tileX < map.width && tileY >= 0 && tileY < map.height;
}

// Cherche la tuile libre la plus proche d'une cible bloque et accessible depuis le joueur.
function findNearestReachableTile(
  scene,
  map,
  playerTileX,
  playerTileY,
  targetTileX,
  targetTileY,
  allowDiagonal
) {
  if (!map) return null;

  const visited = new Set();
  const dirs4 = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];
  const dirs8 = [
    ...dirs4,
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 },
  ];
  const dirs = allowDiagonal ? dirs8 : dirs4;

  const maxRadius = map.width + map.height; // bornage raisonnable
  const queue = [{ x: targetTileX, y: targetTileY, dist: 0 }];
  visited.add(`${targetTileX},${targetTileY}`);

  while (queue.length > 0) {
    const { x, y, dist } = queue.shift();
    if (dist > maxRadius) break;

    if (isValidTile(map, x, y) && !isTileBlocked(scene, x, y)) {
      const path = findPathForPlayer(
        scene,
        map,
        playerTileX,
        playerTileY,
        x,
        y,
        allowDiagonal
      );
      if (path && path.length > 0) {
        return { x, y };
      }
    }

    dirs.forEach(({ dx, dy }) => {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) return;
      visited.add(key);
      if (isValidTile(map, nx, ny) && dist + 1 <= maxRadius) {
        queue.push({ x: nx, y: ny, dist: dist + 1 });
      }
    });
  }

  return null;
}
