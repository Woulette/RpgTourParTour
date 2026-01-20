import { PLAYER_SPEED } from "../../config/constants.js";
import { applyMoveCost } from "../../features/combat/runtime/movement.js";
import { showFloatingTextOverEntity } from "../../features/combat/runtime/floatingText.js";
import { maybeHandleMapExit, maybeHandlePortal } from "../../features/maps/world.js";
import { maybeHandleDungeonExit } from "../../features/dungeons/runtime.js";
import {
  blockTile,
  isTileBlocked,
  unblockTile,
} from "../../collision/collisionGrid.js";
import { recalcDepths } from "../../features/maps/world/decor.js";
import { createCalibratedWorldToTile } from "../../features/maps/world/util.js";

// Détermine le nom de direction d'animation à partir d'un vecteur.
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
  tileY,
  calculatePath
) {
  if (!map) return;
  if (
    tileX < 0 ||
    tileX >= map.width ||
    tileY < 0 ||
    tileY >= map.height
  ) {
    return;
  }

  if (
    typeof player.currentTileX !== "number" ||
    typeof player.currentTileY !== "number"
  ) {
    const worldToTile = createCalibratedWorldToTile(map, groundLayer);
    const t = worldToTile(player.x, player.y);
    if (!t) return;
    player.currentTileX = t.x;
    player.currentTileY = t.y;
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

// Déplacement le long d'un chemin discret (liste de tuiles).
export function movePlayerAlongPath(
  scene,
  player,
  map,
  groundLayer,
  path,
  moveCost = 0,
  onCompleteAll
) {
  if (!path || path.length === 0) {
    player.isMoving = false;
    // Le début de combat reste géré dans playerMovement via maybeStartPendingCombat.
    if (typeof onCompleteAll === "function") {
      onCompleteAll();
    }
    return;
  }

  player.isMoving = true;
  const nextTile = path.shift();

  if (
    player.blocksMovement &&
    !player._blockedTile &&
    typeof player.currentTileX === "number" &&
    typeof player.currentTileY === "number"
  ) {
    blockTile(scene, player.currentTileX, player.currentTileY);
    player._blockedTile = {
      x: player.currentTileX,
      y: player.currentTileY,
    };
  }

  // Collision logique : on ne se déplace jamais sur une tuile bloquée
  if (isTileBlocked(scene, nextTile.x, nextTile.y)) {
    player.isMoving = false;
    if (typeof onCompleteAll === "function") {
      onCompleteAll();
    }
    return;
  }

  const worldPos = map.tileToWorldXY(
    nextTile.x,
    nextTile.y,
    undefined,
    undefined,
    groundLayer
  );

  const targetX = worldPos.x + map.tileWidth / 2;
  const targetY = worldPos.y + map.tileHeight / 2;

  updatePlayerDepth(scene, player);

  const dxWorld = targetX - player.x;
  const dyWorld = targetY - player.y;
  const dir = getDirectionName(dxWorld, dyWorld);
  const animPrefix = player.animPrefix || "player";
  player.lastDirection = dir;
  if (
    player.anims &&
    scene.anims &&
    scene.anims.exists &&
    scene.anims.exists(`${animPrefix}_run_${dir}`)
  ) {
    player.anims.play(`${animPrefix}_run_${dir}`, true);
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
      updatePlayerDepth(scene, player);

      if (player.blocksMovement) {
        const prev = player._blockedTile;
        if (prev && (prev.x !== nextTile.x || prev.y !== nextTile.y)) {
          unblockTile(scene, prev.x, prev.y);
        }
        blockTile(scene, nextTile.x, nextTile.y);
        player._blockedTile = { x: nextTile.x, y: nextTile.y };
      }

      if (path.length > 0) {
        movePlayerAlongPath(
          scene,
          player,
          map,
          groundLayer,
          path,
          moveCost,
          onCompleteAll
        );
      } else {
        player.isMoving = false;
        player.currentMoveTween = null;
        player.movePath = [];

                // Applique le coû t de déplacement au système de combat (PM, HUD)
        if (!player.isRemote) {
          applyMoveCost(scene, player, moveCost);
          if (moveCost > 0 && scene.combatState && scene.combatState.enCours) {
            showFloatingTextOverEntity(scene, player, `${moveCost}`, {
              color: "#22c55e",
            });
          }
        }

        if (player.anims && player.anims.currentAnim) {
          player.anims.stop();
          const idleKey = `${animPrefix}_idle_${player.lastDirection || "south-east"}`;
          if (scene.textures?.exists && scene.textures.exists(idleKey)) {
            player.setTexture(idleKey);
          } else {
            player.setTexture(player.baseTextureKey || animPrefix);
          }
        }

                // Si une sortie de map est en attente et que le joueur est sur
        // la tuile cible, on laisse world.js gérer la transition.
        if (!player.isRemote) {
          maybeHandleMapExit(scene);
          maybeHandlePortal(scene);
          maybeHandleDungeonExit(scene);
        }

        if (typeof onCompleteAll === "function") {
          onCompleteAll();
        }
      }
    },
  });
}

function updatePlayerDepth(scene, player) {
  recalcDepths(scene);
}
