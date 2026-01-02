import { addItem } from "../../inventory/runtime/inventoryCore.js";
import { blockTile, isTileBlocked } from "../../../collision/collisionGrid.js";
import { findPathForPlayer } from "../../../entities/movement/pathfinding.js";
import { movePlayerAlongPath } from "../../../entities/movement/runtime.js";
import { isUiBlockingOpen } from "../../ui/uiBlock.js";

const WELL_TEXTURE_KEY = "puits";
const COOLDOWN_MS = 60000;
const HARVEST_MS = 3000;

function isPlayerHarvestingAny(player) {
  return (
    player?.isHarvestingTree ||
    player?.isHarvestingHerb ||
    player?.isHarvestingWell
  );
}

function cancelPendingWellHarvest(player, node) {
  if (!player) return;
  if (player.currentWellHarvestTimer?.remove) {
    player.currentWellHarvestTimer.remove(false);
  }
  if (node) {
    node.isHarvesting = false;
  }
  if (player.currentWellHarvestNode) {
    player.currentWellHarvestNode.isHarvesting = false;
  }
  player.currentWellHarvestTimer = null;
  player.currentWellHarvestNode = null;
  player.isHarvestingWell = false;
}

function showWellReward(scene, node, qty) {
  if (!scene) return;
  const style = {
    fontFamily: "system-ui, sans-serif",
    fontSize: "14px",
    color: "#86e7ff",
    stroke: "#001018",
    strokeThickness: 3,
  };
  const txt = scene.add.text(node.x, node.y - 40, `+${qty} eau`, style);
  txt.setOrigin(0.5, 1);
  txt.setDepth(node.y + 10);
  if (scene.hudCamera) scene.hudCamera.ignore(txt);
  scene.tweens.add({
    targets: txt,
    y: node.y - 70,
    alpha: 0,
    duration: 1500,
    ease: "Cubic.easeOut",
    onComplete: () => {
      txt.destroy();
    },
  });
}

function findAdjacentTileNearNode(scene, map, node, player) {
  if (!map) return null;
  const { tileX, tileY } = node;
  const candidates = [
    { x: tileX + 1, y: tileY },
    { x: tileX - 1, y: tileY },
    { x: tileX, y: tileY + 1 },
    { x: tileX, y: tileY - 1 },
  ];
  const insideMap = (t) =>
    t.x >= 0 && t.x < map.width && t.y >= 0 && t.y < map.height;
  const free = candidates.filter(
    (t) => insideMap(t) && !isTileBlocked(scene, t.x, t.y)
  );
  if (free.length === 0) return null;
  const px =
    typeof player.currentTileX === "number" ? player.currentTileX : tileX;
  const py =
    typeof player.currentTileY === "number" ? player.currentTileY : tileY;
  free.sort((a, b) => {
    const da = (a.x - px) * (a.x - px) + (a.y - py) * (a.y - py);
    const db = (b.x - px) * (b.x - px) + (b.y - py) * (b.y - py);
    return da - db;
  });
  return free[0];
}

export function spawnTestWells(scene, map, player, mapDef) {
  if (!scene || !map || !player) return;
  const positions =
    (mapDef && Array.isArray(mapDef.wellPositions) && mapDef.wellPositions) ||
    [];
  if (positions.length === 0) return;

  const nodes = [];

  positions.forEach((pos) => {
    if (typeof pos.tileX !== "number" || typeof pos.tileY !== "number") {
      return;
    }
    if (
      pos.tileX < 0 ||
      pos.tileY < 0 ||
      pos.tileX >= map.width ||
      pos.tileY >= map.height
    ) {
      return;
    }

    const offsetX = typeof pos.offsetX === "number" ? pos.offsetX : 0;
    const offsetY = typeof pos.offsetY === "number" ? pos.offsetY : 0;

    const worldPos = map.tileToWorldXY(pos.tileX, pos.tileY);
    const x = worldPos.x + map.tileWidth / 2 + offsetX;
    const y = worldPos.y + map.tileHeight + offsetY;

    const sprite = scene.add.sprite(x, y, WELL_TEXTURE_KEY);
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(y);
    sprite.setInteractive({ useHandCursor: true });

    const node = {
      x,
      y,
      tileX: pos.tileX,
      tileY: pos.tileY,
      cooldownUntil: 0,
      isHarvesting: false,
      sprite,
      hoverHighlight: null,
    };

    sprite.on("pointerover", () => {
      if (node.cooldownUntil > Date.now() || node.isHarvesting) return;
      if (!node.hoverHighlight && scene.add) {
        const overlay = scene.add.sprite(node.x, node.y, WELL_TEXTURE_KEY);
        overlay.setOrigin(sprite.originX, sprite.originY);
        overlay.setBlendMode(Phaser.BlendModes.ADD);
        overlay.setAlpha(0.3);
        overlay.setDepth((sprite.depth || 0) + 1);
        if (scene.hudCamera) {
          scene.hudCamera.ignore(overlay);
        }
        node.hoverHighlight = overlay;
      }
    });

    sprite.on("pointerout", () => {
      if (node.hoverHighlight) {
        node.hoverHighlight.destroy();
        node.hoverHighlight = null;
      }
    });

    const interact = () => {
      const now = Date.now();
      if (node.cooldownUntil > now || node.isHarvesting) {
        cancelPendingWellHarvest(player, node);
        return;
      }
      node.isHarvesting = true;
      player.isHarvestingWell = true;
      player.currentWellHarvestNode = node;

      if (player.currentMoveTween) {
        player.currentMoveTween.stop();
        player.currentMoveTween = null;
        player.isMoving = false;
        player.movePath = [];
      }

      if (scene.time && scene.time.delayedCall) {
        player.currentWellHarvestTimer = scene.time.delayedCall(HARVEST_MS, () => {
          if (!sprite.active) {
            cancelPendingWellHarvest(player, node);
            return;
          }
          const qty = Phaser.Math.Between(1, 10);
          addItem(player.inventory, "eau", qty);
          showWellReward(scene, node, qty);
          node.cooldownUntil = Date.now() + COOLDOWN_MS;
          node.isHarvesting = false;
          player.isHarvestingWell = false;
          player.currentWellHarvestNode = null;
          player.currentWellHarvestTimer = null;
          sprite.setTint(0x555555);
          sprite.setAlpha(0.6);
          if (scene.time && scene.time.delayedCall) {
            scene.time.delayedCall(COOLDOWN_MS, () => {
              if (!sprite.active) return;
              sprite.clearTint();
              sprite.setAlpha(1);
            });
          }
        });
      }
    };

    sprite.on("pointerdown", (pointer, lx, ly, event) => {
      if (event?.stopPropagation) event.stopPropagation();
      if (isUiBlockingOpen()) return;
      if (scene.combatState && scene.combatState.enCours) return;
      if (scene.prepState && scene.prepState.actif) return;
      if (node.cooldownUntil > Date.now()) return;
      if (node.isHarvesting || isPlayerHarvestingAny(player)) return;
      const combatOverlay = document.getElementById("combat-result-overlay");
      if (combatOverlay && !combatOverlay.classList.contains("combat-result-hidden")) {
        return;
      }

      player.isHarvestingWell = true;
      player.currentWellHarvestNode = node;
      if (player.currentMoveTween) {
        player.currentMoveTween.stop();
        player.currentMoveTween = null;
        player.isMoving = false;
        player.movePath = [];
      }

      const isAdjacent =
        typeof player.currentTileX === "number" &&
        typeof player.currentTileY === "number" &&
        Math.abs(player.currentTileX - node.tileX) +
          Math.abs(player.currentTileY - node.tileY) ===
          1;
      if (isAdjacent) {
        interact();
        return;
      }

      const targetTile = findAdjacentTileNearNode(scene, map, node, player);
      if (!targetTile) {
        cancelPendingWellHarvest(player, node);
        return;
      }

      const allowDiagonal = !(scene.combatState && scene.combatState.enCours);
      const path = findPathForPlayer(
        scene,
        map,
        player.currentTileX,
        player.currentTileY,
        targetTile.x,
        targetTile.y,
        allowDiagonal
      );
      if (!path || path.length === 0) {
        cancelPendingWellHarvest(player, node);
        return;
      }

      movePlayerAlongPath(
        scene,
        player,
        map,
        scene.groundLayer || map.layers?.[0],
        path,
        0,
        () => {
          const adj =
            typeof player.currentTileX === "number" &&
            typeof player.currentTileY === "number" &&
            Math.abs(player.currentTileX - node.tileX) +
              Math.abs(player.currentTileY - node.tileY) ===
              1;
          if (adj) {
            interact();
          } else {
            cancelPendingWellHarvest(player, node);
          }
        }
      );
    });

    nodes.push(node);
    blockTile(scene, pos.tileX, pos.tileY);
  });

  scene.wellNodes = nodes;
}
