import { harvestTree } from "./harvest.js";

const TREE_TEXTURE_KEY = "tree_chene";
const TREE_STUMP_TEXTURE_KEY = "tree_chene_stump";
const CUT_DURATION_MS = 3000;
const REGROW_DURATION_MS = 30000;

// Positions fixes d'arbres par map (coordonnées tuiles)
const FIXED_TREE_POSITIONS_BY_MAP = {
  // Map de départ actuelle
  Map1Andemia: [
    { tileX: 7, tileY: 18 },
    { tileX: 15, tileY: 24 },
    { tileX: 26, tileY: 18 },
  ],
};

/**
 * Spawn de quelques arbres de test pour le métier bûcheron.
 * Désormais : positions fixes sur la map, pour que les arbres
 * soient toujours au même endroit à chaque chargement.
 *
 * @param {Phaser.Scene} scene
 * @param {Phaser.Tilemaps.Tilemap} map
 * @param {object} player
 * @param {string} [mapKey]
 */
export function spawnTestTrees(scene, map, player, mapKey) {
  if (!scene || !map || !player) return;

  const effectiveMapKey = mapKey || "Map1Andemia";
  const positions =
    FIXED_TREE_POSITIONS_BY_MAP[effectiveMapKey] ||
    FIXED_TREE_POSITIONS_BY_MAP.Map1Andemia ||
    [];

  const nodes = [];

  positions.forEach((pos) => {
    const tileX = pos.tileX;
    const tileY = pos.tileY;

    const worldPos = map.tileToWorldXY(tileX, tileY);
    const x = worldPos.x + map.tileWidth / 2;
    const y = worldPos.y + map.tileHeight; // base de la tuile

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

    treeSprite.on("pointerdown", () => {
      if (node.harvested || node.isHarvesting) return;

      const maxDistSq = 80 * 80;

      const startCut = () => {
        node.isHarvesting = true;

        if (scene.time && scene.time.delayedCall) {
          scene.time.delayedCall(CUT_DURATION_MS, () => {
            if (!scene.scene || !scene.scene.isActive() || node.harvested) {
              node.isHarvesting = false;
              return;
            }

            const result = harvestTree(scene, player, node);
            node.isHarvesting = false;

            if (!result.success) return;

            node.harvested = true;

            if (node.hoverHighlight) {
              node.hoverHighlight.destroy();
              node.hoverHighlight = null;
            }

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

      // Déjà à portée : on commence à couper immédiatement
      if (distSq <= maxDistSq) {
        startCut();
        return;
      }

      // Trop loin : on attend que le joueur se rapproche (son clic déclenche déjà le déplacement)
      if (scene.time && scene.time.addEvent) {
        const checkEvent = scene.time.addEvent({
          delay: 150,
          loop: true,
          callback: () => {
            if (!scene.scene || !scene.scene.isActive() || node.harvested) {
              node.isHarvesting = false;
              checkEvent.remove(false);
              return;
            }

            const cdx = player.x - node.x;
            const cdy = player.y - node.y;
            const cdistSq = cdx * cdx + cdy * cdy;

            if (cdistSq <= maxDistSq) {
              checkEvent.remove(false);
              startCut();
            }
          },
        });
      }
    });

    nodes.push(node);
  });

  scene.bucheronNodes = nodes;
}
