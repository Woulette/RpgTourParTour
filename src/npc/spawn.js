import { blockTile } from "../collision/collisionGrid.js";
import { questGiverNpcs } from "./catalog/questGivers.js";
import { startNpcInteraction } from "./interaction.js";
import {
  getNpcMarker,
  getQuestState,
  getCurrentQuestStage,
  getQuestDef,
} from "../quests/index.js";
import { on as onStoreEvent } from "../state/store.js";

const ALL_NPCS = [
  ...questGiverNpcs,
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

function shouldSpawnNpc(def, player) {
  if (!def) return false;
  if (!def.requireQuestId) return true;
  const state = getQuestState(player, def.requireQuestId, { emit: false });
  if (!state) return false;
  if (def.requireQuestState && state.state !== def.requireQuestState) return false;
  if (def.requireQuestStageId) {
    const questDef = getQuestDef(def.requireQuestId);
    const stage = questDef ? getCurrentQuestStage(questDef, state) : null;
    const stageId = stage?.id || null;
    if (Array.isArray(def.requireQuestStageId)) {
      if (!def.requireQuestStageId.includes(stageId)) return false;
    } else if (stageId !== def.requireQuestStageId) {
      return false;
    }
  }
  return true;
}

function spawnNpcInstance(scene, map, groundLayer, def) {
  const { tileX, tileY } = def;
  const worldPos = map.tileToWorldXY(
    tileX,
    tileY,
    undefined,
    undefined,
    groundLayer
  );
  const offsetX = typeof def.offsetX === "number" ? def.offsetX : 0;
  const offsetY = typeof def.offsetY === "number" ? def.offsetY : 0;
  const x = worldPos.x + map.tileWidth / 2 + offsetX;
  const y = worldPos.y + map.tileHeight + offsetY;

  const sprite = scene.add.sprite(x, y, def.textureKey);
  sprite.setOrigin(0.5, 1);
  if (typeof def.scale === "number" && Number.isFinite(def.scale)) {
    sprite.setScale(def.scale);
  }
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
    conditional: Boolean(def.requireQuestId),
  };

  sprite.setInteractive({ useHandCursor: true });

  sprite.on("pointerover", () => {
    if (npcInstance.hoverHighlight || !scene.add) return;

    const overlay = scene.add.sprite(sprite.x, sprite.y, def.textureKey);
    overlay.setOrigin(sprite.originX, sprite.originY);
    if (typeof sprite.scaleX === "number" && typeof sprite.scaleY === "number") {
      overlay.setScale(sprite.scaleX, sprite.scaleY);
    }
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
  return npcInstance;
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
    marker.setDepth(Math.max((sprite.depth || 0) + 2, 100010));
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
    if (!shouldSpawnNpc(def, scene.player)) return;
    spawnNpcInstance(scene, map, groundLayer, def);
  });

  // Met à jour les marqueurs une première fois pour cette map
  refreshNpcQuestMarkers(scene, scene.player);

  // Etablie un listener global une seule fois pour réagir aux mises à jour de quête
  if (!questMarkerUnsubscribe) {
    questMarkerUnsubscribe = onStoreEvent("quest:updated", () => {
      if (!scene || !scene.npcs) return;
      const byId = new Map(scene.npcs.map((n) => [n.id, n]));
      const currentMapKey = scene.currentMapKey || mapId;
      const currentMap = scene.map || map;
      const currentGroundLayer = scene.groundLayer || groundLayer;
      const currentMapNpcs = ALL_NPCS.filter(
        (npc) => npc.mapId === currentMapKey
      );
      currentMapNpcs.forEach((def) => {
        const want = shouldSpawnNpc(def, scene.player);
        const existing = byId.get(def.id);
        if (want && !existing) {
          spawnNpcInstance(scene, currentMap, currentGroundLayer, def);
        } else if (!want && existing && existing.conditional) {
          existing.sprite.destroy();
          if (existing.hoverHighlight) existing.hoverHighlight.destroy();
          if (existing.questMarker) existing.questMarker.destroy();
          scene.npcs = scene.npcs.filter((n) => n !== existing);
        }
      });
      refreshNpcQuestMarkers(scene, scene.player);
    });
  }

  if (!inventoryMarkerUnsubscribe) {
    inventoryMarkerUnsubscribe = onStoreEvent("inventory:updated", () => {
      refreshNpcQuestMarkers(scene, scene.player);
    });
  }
}
