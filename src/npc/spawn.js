import { blockTile } from "../collision/collisionGrid.js";
import { trainerNpcs } from "./catalog/trainers.js";
import { merchantNpcs } from "./catalog/merchants.js";
import { questGiverNpcs } from "./catalog/questGivers.js";
import { flavorNpcs } from "./catalog/flavor.js";
import { startNpcInteraction } from "./interaction.js";
import {
  getNpcMarker,
} from "../quests/index.js";
import { on as onStoreEvent } from "../state/store.js";

const ALL_NPCS = [
  ...trainerNpcs,
  ...merchantNpcs,
  ...questGiverNpcs,
  ...flavorNpcs,
];

let questMarkerUnsubscribe = null;
let inventoryMarkerUnsubscribe = null;

export function preloadNpcs(scene) {
  if (!scene) return;

  // Textures des PNJ
  ALL_NPCS.forEach((npc) => {
    if (!npc || !npc.textureKey || !npc.spritePath) return;
    scene.load.image(npc.textureKey, npc.spritePath);
  });

  // Icônes de quêtes
  scene.load.image(
    "npc_aluineeks_keeper",
    "assets/npc/PnjAluineeksSouth-west.png"
  );

  scene.load.image("quest_exclamation", "assets/exclamations.png");
  scene.load.image("quest_question", "assets/interogations.png");
}

function refreshNpcQuestMarkers(scene, player) {
  if (!scene || !scene.npcs) return;
  scene.npcs.forEach((npcInstance) => {
    if (!npcInstance) return;

    // Détruit l'ancien marqueur éventuel
    if (npcInstance.questMarker && npcInstance.questMarker.destroy) {
      npcInstance.questMarker.destroy();
      npcInstance.questMarker = null;
    }

    const npcId = npcInstance.id;
    let markerTexture = null;
    const markerSymbol = getNpcMarker(player, npcId);
    if (markerSymbol === "!") markerTexture = "quest_exclamation";
    else if (markerSymbol === "?") markerTexture = "quest_question";

    if (!markerTexture) return;

    const sprite = npcInstance.sprite;
    if (!sprite) return;

    const margin = 0;
    const markerY = sprite.y - sprite.displayHeight - margin;
    const marker = scene.add.image(sprite.x, markerY, markerTexture);
    marker.setOrigin(0.5, 1);
    marker.setDepth((sprite.depth || 0) + 2);
    if (scene.hudCamera) {
      scene.hudCamera.ignore(marker);
    }
    npcInstance.questMarker = marker;
  });
}

export function spawnNpcsForMap(scene, map, groundLayer, mapId) {
  if (!scene || !map || !groundLayer) return;

  const npcsForMap = ALL_NPCS.filter((npc) => npc.mapId === mapId);
  if (npcsForMap.length === 0) return;

  scene.npcs = scene.npcs || [];

  npcsForMap.forEach((def) => {
    const { tileX, tileY } = def;
    const worldPos = map.tileToWorldXY(
      tileX,
      tileY,
      undefined,
      undefined,
      groundLayer
    );
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
      questMarker: null,
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

  // Met à jour les marqueurs une première fois pour cette map
  refreshNpcQuestMarkers(scene, scene.player);

  // Etablie un listener global une seule fois pour réagir aux mises à jour de quête
  if (!questMarkerUnsubscribe) {
    questMarkerUnsubscribe = onStoreEvent("quest:updated", () => {
      refreshNpcQuestMarkers(scene, scene.player);
    });
  }

  if (!inventoryMarkerUnsubscribe) {
    inventoryMarkerUnsubscribe = onStoreEvent("inventory:updated", () => {
      refreshNpcQuestMarkers(scene, scene.player);
    });
  }
}
