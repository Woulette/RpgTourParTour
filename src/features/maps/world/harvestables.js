import { blockTile, unblockTile } from "../../../collision/collisionGrid.js";

const HARVESTABLE_NODE_KEYS = ["bucheronNodes", "alchimisteNodes", "wellNodes"];

function setNodeState(scene, node, visible, updateCollision) {
  if (!node) return;

  if (!visible && node.hoverHighlight?.destroy) {
    node.hoverHighlight.destroy();
    node.hoverHighlight = null;
  }

  const sprite = node.sprite;
  if (sprite && sprite.setVisible) {
    sprite.setVisible(visible);
  }
  if (sprite && !visible && sprite.disableInteractive) {
    sprite.disableInteractive();
  }
  if (sprite && visible && sprite.setInteractive) {
    sprite.setInteractive({ useHandCursor: true });
  }

  if (!updateCollision) return;
  if (typeof node.tileX !== "number" || typeof node.tileY !== "number") return;

  if (visible) {
    blockTile(scene, node.tileX, node.tileY);
  } else {
    unblockTile(scene, node.tileX, node.tileY);
  }
}

export function setHarvestablesVisible(scene, visible, options = {}) {
  if (!scene) return;
  const updateCollision = options.updateCollision !== false;

  HARVESTABLE_NODE_KEYS.forEach((key) => {
    const nodes = scene[key];
    if (!Array.isArray(nodes)) return;
    nodes.forEach((node) => {
      setNodeState(scene, node, visible, updateCollision);
    });
  });
}
