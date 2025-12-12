import { harvestTree } from "./harvest.js";
import { blockTile, isTileBlocked } from "../../collision/collisionGrid.js";
import { findPathForPlayer } from "../../entities/movement/pathfinding.js";
import { movePlayerAlongPath } from "../../entities/movement/runtime.js";

const TREE_TEXTURE_KEY = "tree_chene";
const TREE_STUMP_TEXTURE_KEY = "tree_chene_stump";
const CUT_DURATION_MS = 3000;
const REGROW_DURATION_MS = 30000;

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
      const txtXp = scene.add.text(
        baseX,
        baseY,
        `+${result.gainedXp} XP`,
        style
      );
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
        `+${result.gainedItems} bois`,
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
 * Spawn d'arbres pour le métier bucheron.
 * Chaque map fournit ses positions via mapDef.treePositions : aucune
 * position n'est partagée entre cartes.
 *
 * @param {Phaser.Scene} scene
 * @param {Phaser.Tilemaps.Tilemap} map
 * @param {object} player
 * @param {object} [mapDef]
 */
export function spawnTestTrees(scene, map, player, mapDef) {
  if (!scene || !map || !player) return;

  const positions =
    (mapDef && Array.isArray(mapDef.treePositions) && mapDef.treePositions) ||
    [];

  if (positions.length === 0) {
    return;
  }

  const nodes = [];

  positions.forEach((pos) => {
    if (typeof pos.tileX !== "number" || typeof pos.tileY !== "number") {
      return;
    }

    const offsetX =
      typeof pos.offsetX === "number" ? pos.offsetX : 0;
    const offsetY =
      typeof pos.offsetY === "number" ? pos.offsetY : 0;

    if (
      pos.tileX < 0 ||
      pos.tileY < 0 ||
      pos.tileX >= map.width ||
      pos.tileY >= map.height
    ) {
      return;
    }

    const tileX = pos.tileX;
    const tileY = pos.tileY;

    const worldPos = map.tileToWorldXY(tileX, tileY);
    const x = worldPos.x + map.tileWidth / 2 + offsetX;
    const y = worldPos.y + map.tileHeight + offsetY; // base de la tuile, avec un léger offset sprite optionnel

    const treeSprite = scene.add.sprite(x, y, TREE_TEXTURE_KEY);
    treeSprite.setOrigin(0.5, 1); // pieds de l'arbre sur le sol
    treeSprite.setDepth(y);

    const node = {
      x,
      y,
      tileX,
      tileY,
      resourceId: "chene",
      amount: 1,
      harvested: false,
      isHarvesting: false,
      sprite: treeSprite,
      hoverHighlight: null,
    };

    treeSprite.setInteractive({ useHandCursor: true });

    treeSprite.on("pointerover", () => {
      if (node.harvested) return;

      // Effet lumineux comme pour les corbeaux :
      // on dessine un sprite en mode ADD par-dessus l'arbre.
      if (!node.hoverHighlight && scene.add) {
        const overlay = scene.add.sprite(node.x, node.y, TREE_TEXTURE_KEY);
        overlay.setOrigin(treeSprite.originX, treeSprite.originY);
        overlay.setBlendMode(Phaser.BlendModes.ADD);
        overlay.setAlpha(0.3);
        overlay.setDepth((treeSprite.depth || 0) + 1);

        if (scene.hudCamera) {
          scene.hudCamera.ignore(overlay);
        }

        node.hoverHighlight = overlay;
      }
    });

    treeSprite.on("pointerout", () => {
      if (node.hoverHighlight) {
        node.hoverHighlight.destroy();
        node.hoverHighlight = null;
      }
    });

    treeSprite.on("pointerdown", (pointer, localX, localY, event) => {
      if (event && event.stopPropagation) {
        event.stopPropagation();
      }

      if (node.harvested || node.isHarvesting) return;

      const maxDistSq = 80 * 80;

      const startCut = () => {
        node.isHarvesting = true;
        player.isHarvestingTree = true;

        if (scene.time && scene.time.delayedCall) {
          scene.time.delayedCall(CUT_DURATION_MS, () => {
            if (!scene.scene || !scene.scene.isActive() || node.harvested) {
              node.isHarvesting = false;
              player.isHarvestingTree = false;
              return;
            }

            const result = harvestTree(scene, player, node);
            node.isHarvesting = false;
            player.isHarvestingTree = false;

            if (!result.success) return;

            node.harvested = true;

            if (node.hoverHighlight) {
              node.hoverHighlight.destroy();
              node.hoverHighlight = null;
            }

            showHarvestFeedback(scene, node, result);

            // Change visuellement l'arbre en souche si la texture existe,
            // sinon on garde le visuel "fané".
            if (
              scene.textures &&
              scene.textures.exists &&
              scene.textures.exists(TREE_STUMP_TEXTURE_KEY)
            ) {
              treeSprite.setTexture(TREE_STUMP_TEXTURE_KEY);
              treeSprite.setOrigin(0.5, 1);
              treeSprite.clearTint();
              treeSprite.setAlpha(1);
            } else {
              treeSprite.setTint(0x555555);
              treeSprite.setAlpha(0.5);
            }

            // Timer de repousse : après un certain temps, l'arbre revient.
            if (scene.time && scene.time.delayedCall) {
              scene.time.delayedCall(REGROW_DURATION_MS, () => {
                if (!treeSprite.active) return;

                node.harvested = false;
                node.isHarvesting = false;

                treeSprite.clearTint();
                treeSprite.setAlpha(1);

                if (
                  scene.textures &&
                  scene.textures.exists &&
                  scene.textures.exists(TREE_TEXTURE_KEY)
                ) {
                  treeSprite.setTexture(TREE_TEXTURE_KEY);
                  treeSprite.setOrigin(0.5, 1);
                }
              });
            }
          });
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

      // Déjà à portée (case adjacente) : on commence à couper immédiatement
      if (isAdjacentNow || distSq <= maxDistSq * 0.25) {
        if (player.currentMoveTween) {
          player.currentMoveTween.stop();
          player.currentMoveTween = null;
          player.isMoving = false;
        }
        startCut();
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
            startCut();
          }
        }
      );
    });

    nodes.push(node);

    // Enregistre cette tuile comme bloquée pour le déplacement du joueur
    blockTile(scene, tileX, tileY);
  });

  scene.bucheronNodes = nodes;
}
