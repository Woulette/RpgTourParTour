import { harvestHerb } from "./harvest.js";
import { blockTile, isTileBlocked } from "../../../collision/collisionGrid.js";
import { findPathForPlayer } from "../../../entities/movement/pathfinding.js";
import { movePlayerAlongPath } from "../../../entities/movement/runtime.js";
import { isUiBlockingOpen } from "../../ui/uiBlock.js";
import { getNetClient, getNetPlayerId } from "../../../app/session.js";

const HERB_TEXTURE_KEY = "herb_ortie";
const HERB_STUMP_TEXTURE_KEY = "herb_ortie_stump";
export const HERB_HARVEST_DURATION_MS = 2500;
export const HERB_REGROW_DURATION_MS = 25000;
export const HERB_RESOURCE_KIND = "herb";

function cancelCurrentHarvest(player) {
  if (!player) return;
  if (player.currentHerbHarvestTimer?.remove) {
    player.currentHerbHarvestTimer.remove(false);
  }
  if (player.currentHerbHarvestNode) {
    player.currentHerbHarvestNode.isHarvesting = false;
  }
  player.currentHerbHarvestTimer = null;
  player.currentHerbHarvestNode = null;
  player.isHarvestingHerb = false;
}

function showHarvestFeedback(scene, node, result) {
  if (!scene || !result) return;

  const baseX = node.x;
  const baseY = node.y - 40;

  const style = {
    fontFamily: "system-ui, sans-serif",
    fontSize: "14px",
    color: "#f5f7ff",
    stroke: "#000000",
    strokeThickness: 3,
  };

  if (result.gainedXp && result.gainedXp > 0) {
    const txtXp = scene.add.text(baseX, baseY, `+${result.gainedXp} XP`, style);
    txtXp.setOrigin(0.5, 1);
    txtXp.setDepth(node.y + 10);

    if (scene.hudCamera) {
      scene.hudCamera.ignore(txtXp);
    }
    scene.tweens.add({
      targets: txtXp,
      y: baseY - 30,
      alpha: 0,
      duration: 1900,
      ease: "Cubic.easeOut",
      onComplete: () => {
        txtXp.destroy();
      },
    });
  }

  if (result.gainedItems && result.gainedItems > 0) {
    scene.time.delayedCall(600, () => {
      const txtItems = scene.add.text(
        baseX,
        baseY,
        `+${result.gainedItems} plante`,
        style
      );
      txtItems.setOrigin(0.5, 1);
      txtItems.setDepth(node.y + 10);

      if (scene.hudCamera) {
        scene.hudCamera.ignore(txtItems);
      }
      scene.tweens.add({
        targets: txtItems,
        y: baseY - 30,
        alpha: 0,
        duration: 1900,
        ease: "Cubic.easeOut",
        onComplete: () => {
          txtItems.destroy();
        },
      });
    });
  }
}

function applyHerbHarvestedVisual(scene, node) {
  if (!scene || !node || !node.sprite) return;
  const herbSprite = node.sprite;
  if (node.hoverHighlight) {
    node.hoverHighlight.destroy();
    node.hoverHighlight = null;
  }
  if (
    scene.textures &&
    scene.textures.exists &&
    scene.textures.exists(HERB_STUMP_TEXTURE_KEY)
  ) {
    herbSprite.setTexture(HERB_STUMP_TEXTURE_KEY);
    herbSprite.setOrigin(0.5, 1);
    herbSprite.clearTint();
    herbSprite.setAlpha(1);
  } else {
    herbSprite.setTint(0x555555);
    herbSprite.setAlpha(0.5);
  }
}

function applyHerbRespawnVisual(scene, node) {
  if (!scene || !node || !node.sprite) return;
  const herbSprite = node.sprite;
  herbSprite.clearTint();
  herbSprite.setAlpha(1);
  if (
    scene.textures &&
    scene.textures.exists &&
    scene.textures.exists(HERB_TEXTURE_KEY)
  ) {
    herbSprite.setTexture(HERB_TEXTURE_KEY);
    herbSprite.setOrigin(0.5, 1);
  }
}

export function applyHerbHarvested(scene, player, node, giveReward, reward) {
  if (!node) return;
  let result = null;
  if (giveReward) {
    node.harvested = false;
    result = harvestHerb(scene, player, node);
  } else if (reward) {
    result = {
      success: true,
      node,
      gainedItems: reward.gainedItems || 0,
      gainedXp: reward.gainedXp || 0,
    };
  } else {
    node.harvested = true;
  }
  node.isHarvesting = false;
  if (result && result.success) {
    showHarvestFeedback(scene, node, result);
  }
  node.harvested = true;
  applyHerbHarvestedVisual(scene, node);
}

export function applyHerbRespawn(scene, node) {
  if (!node) return;
  node.harvested = false;
  node.isHarvesting = false;
  applyHerbRespawnVisual(scene, node);
}

function buildHerbNode(scene, map, player, entry) {
  const offsetX = typeof entry.offsetX === "number" ? entry.offsetX : 0;
  const offsetY = typeof entry.offsetY === "number" ? entry.offsetY : 0;
  const tileX = entry.tileX;
  const tileY = entry.tileY;

  const worldPos = map.tileToWorldXY(tileX, tileY);
  const x = worldPos.x + map.tileWidth / 2 + offsetX;
  const y = worldPos.y + map.tileHeight + offsetY;

  const herbSprite = scene.add.sprite(x, y, HERB_TEXTURE_KEY);
  herbSprite.setOrigin(0.5, 1);
  herbSprite.setDepth(y);

  const node = {
    x,
    y,
    tileX,
    tileY,
    resourceId: typeof entry.resourceId === "string" ? entry.resourceId : "ortie",
    amount: 1,
    harvested: entry.harvested === true,
    isHarvesting: false,
    sprite: herbSprite,
    hoverHighlight: null,
    entityId: Number.isInteger(entry.entityId) ? entry.entityId : null,
    kind: HERB_RESOURCE_KIND,
  };

  herbSprite.setInteractive({ useHandCursor: true });

  herbSprite.on("pointerover", () => {
    if (node.harvested) return;

    if (!node.hoverHighlight && scene.add) {
      const overlay = scene.add.sprite(node.x, node.y, HERB_TEXTURE_KEY);
      overlay.setOrigin(herbSprite.originX, herbSprite.originY);
      overlay.setBlendMode(Phaser.BlendModes.ADD);
      overlay.setAlpha(0.3);
      overlay.setDepth((herbSprite.depth || 0) + 1);

      if (scene.hudCamera) {
        scene.hudCamera.ignore(overlay);
      }

      node.hoverHighlight = overlay;
    }
  });

  herbSprite.on("pointerout", () => {
    if (node.hoverHighlight) {
      node.hoverHighlight.destroy();
      node.hoverHighlight = null;
    }
  });

  herbSprite.on("pointerdown", (pointer, localX, localY, event) => {
    if (event && event.stopPropagation) {
      event.stopPropagation();
    }
    if (isUiBlockingOpen()) {
      return;
    }

    if (scene.combatState && scene.combatState.enCours) {
      return;
    }
    if (scene.prepState && scene.prepState.actif) {
      return;
    }

    if (
      node.harvested ||
      node.isHarvesting ||
      player.isHarvestingHerb ||
      player.isHarvestingTree ||
      player.isHarvestingWell
    ) {
      return;
    }

    const combatOverlay = document.getElementById("combat-result-overlay");
    if (combatOverlay && !combatOverlay.classList.contains("combat-result-hidden")) {
      return;
    }

    cancelCurrentHarvest(player);
    player.currentHerbHarvestNode = node;

    if (player.currentMoveTween) {
      player.currentMoveTween.stop();
      player.currentMoveTween = null;
      player.isMoving = false;
      player.movePath = [];
    }

    const maxDistSq = 80 * 80;

    const startHarvest = () => {
      if (player.currentHerbHarvestNode !== node) return;
      node.isHarvesting = true;
      player.isHarvestingHerb = true;

      if (scene.time && scene.time.delayedCall) {
        const timer = scene.time.delayedCall(HERB_HARVEST_DURATION_MS, () => {
          if (!scene.scene || !scene.scene.isActive() || node.harvested) {
            node.isHarvesting = false;
            player.isHarvestingHerb = false;
            player.currentHerbHarvestTimer = null;
            player.currentHerbHarvestNode = null;
            return;
          }

          if (player.currentHerbHarvestNode !== node) {
            node.isHarvesting = false;
            player.isHarvestingHerb = false;
            player.currentHerbHarvestTimer = null;
            return;
          }

          const netClient = getNetClient();
          const playerId = getNetPlayerId();
          const mapId = scene?.currentMapKey || scene?.currentMapDef?.key || null;

          node.isHarvesting = false;
          player.isHarvestingHerb = false;
          player.currentHerbHarvestTimer = null;
          player.currentHerbHarvestNode = null;

          if (netClient && playerId && mapId && Number.isInteger(node.entityId)) {
            netClient.sendCmd("CmdResourceHarvest", {
              playerId,
              mapId,
              entityId: node.entityId,
              kind: HERB_RESOURCE_KIND,
            });
            return;
          }

          const result = harvestHerb(scene, player, node);
          if (!result.success) return;

          node.harvested = true;
          applyHerbHarvestedVisual(scene, node);
          showHarvestFeedback(scene, node, result);

          if (scene.time && scene.time.delayedCall) {
            scene.time.delayedCall(HERB_REGROW_DURATION_MS, () => {
              if (!herbSprite.active) return;
              applyHerbRespawn(scene, node);
            });
          }
        });
        player.currentHerbHarvestTimer = timer;
      }
    };

    const dx = player.x - node.x;
    const dy = player.y - node.y;
    const distSq = dx * dx + dy * dy;

    const isAdjacentNow =
      typeof player.currentTileX === "number" &&
      typeof player.currentTileY === "number" &&
      Math.abs(player.currentTileX - tileX) +
        Math.abs(player.currentTileY - tileY) ===
        1;

    if (isAdjacentNow || distSq <= maxDistSq * 0.25) {
      if (player.currentMoveTween) {
        player.currentMoveTween.stop();
        player.currentMoveTween = null;
        player.isMoving = false;
      }
      startHarvest();
      return;
    }

    const targetTile = findAdjacentTileNearNode(scene, map, node, player);
    if (!targetTile) {
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
        const isAdjacent =
          typeof player.currentTileX === "number" &&
          typeof player.currentTileY === "number" &&
          Math.abs(player.currentTileX - tileX) +
            Math.abs(player.currentTileY - tileY) ===
            1;

        if (isAdjacent) {
          startHarvest();
        }
      }
    );
  });

  if (node.harvested) {
    applyHerbHarvestedVisual(scene, node);
  }

  blockTile(scene, tileX, tileY);
  return node;
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

/**
 * Spawn de plantes pour le metier alchimiste.
 * Chaque map fournit ses positions via mapDef.herbPositions.
 */
export function spawnTestHerbs(scene, map, player, mapDef) {
  if (!scene || !map || !player) return;

  const positions =
    (mapDef && Array.isArray(mapDef.herbPositions) && mapDef.herbPositions) ||
    [];

  if (positions.length === 0) {
    return;
  }

  const entries = positions.map((pos) => ({
    tileX: pos.tileX,
    tileY: pos.tileY,
    offsetX: typeof pos.offsetX === "number" ? pos.offsetX : 0,
    offsetY: typeof pos.offsetY === "number" ? pos.offsetY : 0,
    resourceId: typeof pos.resourceId === "string" ? pos.resourceId : "ortie",
    harvested: false,
  }));

  spawnHerbsFromEntries(scene, map, player, entries);
}

export function spawnHerbsFromEntries(scene, map, player, entries) {
  if (!scene || !map || !player) return [];
  const nodes = [];
  const safeEntries = Array.isArray(entries) ? entries : [];
  safeEntries.forEach((entry) => {
    if (!entry) return;
    if (typeof entry.tileX !== "number" || typeof entry.tileY !== "number") return;
    if (
      entry.tileX < 0 ||
      entry.tileY < 0 ||
      entry.tileX >= map.width ||
      entry.tileY >= map.height
    ) {
      return;
    }
    const node = buildHerbNode(scene, map, player, entry);
    if (node) nodes.push(node);
  });

  scene.alchimisteNodes = nodes;
  return nodes;
}
