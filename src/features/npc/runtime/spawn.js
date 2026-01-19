import { blockTile } from "../../../collision/collisionGrid.js";
import { isUiBlockingOpen } from "../../ui/uiBlock.js";
import { questGiverNpcs } from "../catalog/questGivers.js";
import { startNpcInteraction } from "./interaction.js";
import {
  getNpcMarker,
  getQuestState,
  getCurrentQuestStage,
  getQuestDef,
} from "../../quests/index.js";
import { on as onStoreEvent } from "../../../state/store.js";

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
    "assets/npc/DonjonALuineeksPNJsouth-west.png"
  );

  scene.load.image("quest_exclamation", "assets/tileset/exclamations.png");
  scene.load.image("quest_question", "assets/tileset/interogations.png");
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
  if (
    !scene ||
    !map ||
    !groundLayer ||
    typeof map.tileToWorldXY !== "function" ||
    !Number.isFinite(map.tileWidth) ||
    !Number.isFinite(map.tileHeight) ||
    !groundLayer.layer ||
    !Number.isFinite(groundLayer.layer.baseTileWidth)
  ) {
    return null;
  }
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
    if (isUiBlockingOpen()) return;
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

    const npcId = npcInstance.id;
    let markerTexture = null;
    const markerSymbol = getNpcMarker(player, npcId);
    if (markerSymbol === "!") markerTexture = "quest_exclamation";
    else if (markerSymbol === "?") markerTexture = "quest_question";

    if (!markerTexture) {
      if (npcInstance.questMarker && npcInstance.questMarker.destroy) {
        npcInstance.questMarker.destroy();
        npcInstance.questMarker = null;
      }
      return;
    }

    const sprite = npcInstance.sprite;
    if (!sprite || !sprite.active || !sprite.scene) return;

    const margin = 0;
    let markerY = null;
    try {
      markerY = sprite.y - sprite.displayHeight - margin;
    } catch {
      return;
    }

    if (npcInstance.questMarker && npcInstance.questMarker.destroy) {
      npcInstance.questMarker.destroy();
      npcInstance.questMarker = null;
    }

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
  if (scene?.time?.delayedCall) {
    scene.time.delayedCall(200, () => {
      refreshNpcQuestMarkers(scene, scene.player);
    });
  }

  // Etablie un listener global une seule fois pour réagir aux mises à jour de quête
  if (questMarkerUnsubscribe) {
    questMarkerUnsubscribe();
    questMarkerUnsubscribe = null;
  }

  const isMapReadyForNpcs = (targetMap, targetLayer) =>
    !!(
      targetMap &&
      targetLayer &&
      typeof targetMap.tileToWorldXY === "function" &&
      Number.isFinite(targetMap.tileWidth) &&
      Number.isFinite(targetMap.tileHeight) &&
      targetLayer.layer &&
      Number.isFinite(targetLayer.layer.baseTileWidth)
    );

  const scheduleNpcRefresh = () => {
    if (!scene) return;
    if (scene.__npcQuestRefreshTimer) return;
    const run = () => {
      scene.__npcQuestRefreshTimer = null;
      if (!scene) return;
      if (!isMapReadyForNpcs(scene.map, scene.groundLayer)) return;
      refreshNpcQuestMarkers(scene, scene.player);
    };
    if (scene?.time?.delayedCall) {
      scene.__npcQuestRefreshTimer = scene.time.delayedCall(200, run);
    } else {
      scene.__npcQuestRefreshTimer = setTimeout(run, 200);
    }
  };

  questMarkerUnsubscribe = onStoreEvent("quest:updated", () => {
    if (!scene || !scene.npcs) return;
    const byId = new Map(scene.npcs.map((n) => [n.id, n]));
    const currentMapKey = scene.currentMapKey || mapId;
    const currentMap = scene.map || map;
    const currentGroundLayer = scene.groundLayer || groundLayer;
    if (!isMapReadyForNpcs(currentMap, currentGroundLayer)) {
      scheduleNpcRefresh();
      return;
    }
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

  if (inventoryMarkerUnsubscribe) {
    inventoryMarkerUnsubscribe();
    inventoryMarkerUnsubscribe = null;
  }

  inventoryMarkerUnsubscribe = onStoreEvent("inventory:updated", () => {
    if (!isMapReadyForNpcs(scene?.map, scene?.groundLayer)) {
      scheduleNpcRefresh();
      return;
    }
    refreshNpcQuestMarkers(scene, scene.player);
  });
}
