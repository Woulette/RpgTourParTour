import { PLAYER_SPEED } from "../../config/constants.js";
import { applyMoveCost } from "../../core/combat.js";
import { maybeHandleMapExit } from "../../maps/world.js";
import { isTileBlocked } from "../../collision/collisionGrid.js";

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

  if (player.setDepth) {
    player.setDepth(player.y);
  }

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
      if (player.setDepth) {
        player.setDepth(player.y);
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

        // Applique le coût de déplacement au système de combat (PM, HUD)
        applyMoveCost(scene, player, moveCost);

        if (player.anims && player.anims.currentAnim) {
          player.anims.stop();
          player.setTexture("player");
        }

        // Si une sortie de map est en attente et que le joueur est sur
        // la tuile cible, on laisse world.js gérer la transition.
        maybeHandleMapExit(scene);

        if (typeof onCompleteAll === "function") {
          onCompleteAll();
        }
      }
    },
  });
}
