import { blockTile } from "../collision/collisionGrid.js";
import { trainerNpcs } from "./catalog/trainers.js";
import { merchantNpcs } from "./catalog/merchants.js";
import { questGiverNpcs } from "./catalog/questGivers.js";
import { flavorNpcs } from "./catalog/flavor.js";
import { startNpcInteraction } from "./interaction.js";

const ALL_NPCS = [
  ...trainerNpcs,
  ...merchantNpcs,
  ...questGiverNpcs,
  ...flavorNpcs,
];

export function preloadNpcs(scene) {
  ALL_NPCS.forEach((npc) => {
    if (!npc || !npc.textureKey || !npc.spritePath) return;
    scene.load.image(npc.textureKey, npc.spritePath);
  });
}

export function spawnNpcsForMap(scene, map, groundLayer, mapId) {
  if (!scene || !map || !groundLayer) return;

  const npcsForMap = ALL_NPCS.filter((npc) => npc.mapId === mapId);
  if (npcsForMap.length === 0) return;

  scene.npcs = scene.npcs || [];

  npcsForMap.forEach((def) => {
    const { tileX, tileY } = def;
    const worldPos = map.tileToWorldXY(tileX, tileY, undefined, undefined, groundLayer);
    const x = worldPos.x + map.tileWidth / 2;
    const y = worldPos.y + map.tileHeight;

    const sprite = scene.add.sprite(x, y, def.textureKey);
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(y);

    const npcInstance = {
      def,
      sprite,
      tileX,
      tileY,
      id: def.id,
      type: def.type,
      hoverHighlight: null,
    };

    sprite.setInteractive({ useHandCursor: true });

    sprite.on("pointerover", () => {
      if (npcInstance.hoverHighlight || !scene.add) return;

      const overlay = scene.add.sprite(sprite.x, sprite.y, def.textureKey);
      overlay.setOrigin(sprite.originX, sprite.originY);
      overlay.setBlendMode(Phaser.BlendModes.ADD);
      overlay.setAlpha(0.5);
      overlay.setDepth((sprite.depth || 0) + 1);

      if (scene.hudCamera) {
        scene.hudCamera.ignore(overlay);
      }

      npcInstance.hoverHighlight = overlay;
    });

    sprite.on("pointerout", () => {
      if (npcInstance.hoverHighlight) {
        npcInstance.hoverHighlight.destroy();
        npcInstance.hoverHighlight = null;
      }
    });

    sprite.on("pointerdown", (pointer, localX, localY, event) => {
      if (event && event.stopPropagation) {
        event.stopPropagation();
      }
      if (!scene.player) return;
      startNpcInteraction(scene, scene.player, npcInstance);
    });

    scene.npcs.push(npcInstance);

    blockTile(scene, tileX, tileY);
  });
}
