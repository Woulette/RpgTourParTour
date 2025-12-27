import { blockTile } from "../collision/collisionGrid.js";
import { isTileBlocked } from "../collision/collisionGrid.js";
import { startNpcInteraction } from "../npc/interaction.js";
import { createCalibratedWorldToTile } from "../maps/world/util.js";
import { getNpcMarker } from "../quests/index.js";

function refreshQuestMarkerForNpc(scene, player, npcInstance) {
  if (!scene || !npcInstance) return;

  if (npcInstance.questMarker && npcInstance.questMarker.destroy) {
    npcInstance.questMarker.destroy();
    npcInstance.questMarker = null;
  }

  const markerSymbol = getNpcMarker(player, npcInstance.id);
  const markerTexture =
    markerSymbol === "!"
      ? "quest_exclamation"
      : markerSymbol === "?"
        ? "quest_question"
        : null;

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
}

function findEntranceTileForTileset(scene, tilesetName) {
  if (!scene || !scene.map || !Array.isArray(scene.mapLayers)) return null;

  // 1) Si l'entrée est placée en "tile object" (object layer avec gid), on la détecte ici.
  // C'est le cas de tes grandes images d'entrée de donjon.
  const mapTilesets = Array.isArray(scene.map.tilesets) ? scene.map.tilesets : [];
  const ts = mapTilesets.find((t) => t && t.name === tilesetName) || null;
  if (ts && typeof ts.firstgid === "number") {
    const firstGid = ts.firstgid;
    const next = mapTilesets
      .filter((t) => t && typeof t.firstgid === "number" && t.firstgid > firstGid)
      .sort((a, b) => a.firstgid - b.firstgid)[0];
    const lastGid = next ? next.firstgid - 1 : Number.MAX_SAFE_INTEGER;

    const objectLayers = Array.isArray(scene.map.objects) ? scene.map.objects : [];
    const worldToTile = createCalibratedWorldToTile(scene.map, scene.groundLayer);
    for (const layer of objectLayers) {
      const objs = layer && Array.isArray(layer.objects) ? layer.objects : [];
      for (const obj of objs) {
        if (!obj || typeof obj.gid !== "number") continue;
        if (obj.gid < firstGid || obj.gid > lastGid) continue;
        const pos = worldToTile(obj.x, obj.y - (obj.height || 0) / 2);
        if (pos) return pos;
      }
    }
  }

  // 2) Fallback : scan des tile layers (tuiles classiques).
  for (const layer of scene.mapLayers) {
    if (!layer || !layer.forEachTile) continue;
    let found = null;
    layer.forEachTile((tile) => {
      if (found) return;
      if (!tile || tile.index < 0 || !tile.tileset) return;
      if (tile.tileset.name === tilesetName) {
        found = { x: tile.x, y: tile.y };
      }
    });
    if (found) return found;
  }
  return null;
}

function pickNpcTileNear(scene, originTile) {
  if (!scene || !scene.map || !originTile) return null;
  const { x, y } = originTile;

  const candidates = [
    { x: x + 2, y: y + 1 },
    { x: x + 1, y: y + 2 },
    { x: x - 1, y: y + 2 },
    { x: x - 2, y: y + 1 },
    { x: x + 2, y: y - 1 },
    { x: x - 2, y: y - 1 },
    { x: x + 1, y: y - 2 },
    { x: x - 1, y: y - 2 },
  ];

  for (const c of candidates) {
    if (c.x < 0 || c.y < 0 || c.x >= scene.map.width || c.y >= scene.map.height) {
      continue;
    }
    if (!isTileBlocked(scene, c.x, c.y)) {
      return c;
    }
  }

  return null;
}

export function ensureAluineeksDungeonEntranceNpc(scene) {
  if (!scene || !scene.map || !scene.groundLayer) return;
  if (scene.currentMapKey !== "MapAndemia3") return;

  scene.npcs = scene.npcs || [];
  if (scene.npcs.some((n) => n && n.id === "donjon_aluineeks_keeper")) {
    return;
  }

  const entranceTile =
    findEntranceTileForTileset(scene, "EntreDonjons1Teste") ||
    (scene.player
      ? { x: scene.player.currentTileX ?? 0, y: scene.player.currentTileY ?? 0 }
      : null);

  // Placement manuel possible depuis la définition de map (src/maps/index.js).
  const fixed =
    scene.currentMapDef &&
    scene.currentMapDef.entranceNpcTile &&
    typeof scene.currentMapDef.entranceNpcTile.x === "number" &&
    typeof scene.currentMapDef.entranceNpcTile.y === "number"
      ? scene.currentMapDef.entranceNpcTile
      : null;

  const npcTile = fixed || pickNpcTileNear(scene, entranceTile) || entranceTile;
  if (!npcTile) return;

  const wp = scene.map.tileToWorldXY(
    npcTile.x,
    npcTile.y,
    undefined,
    undefined,
    scene.groundLayer
  );

  const cfgOff =
    scene.currentMapDef &&
    scene.currentMapDef.entranceNpcOffset &&
    typeof scene.currentMapDef.entranceNpcOffset.x === "number" &&
    typeof scene.currentMapDef.entranceNpcOffset.y === "number"
      ? scene.currentMapDef.entranceNpcOffset
      : { x: 0, y: 0 };

  const x = wp.x + scene.map.tileWidth / 2 + cfgOff.x;
  const y = wp.y + scene.map.tileHeight + cfgOff.y;

  const textureKey = scene.textures?.exists("npc_aluineeks_keeper")
    ? "npc_aluineeks_keeper"
    : scene.textures?.exists("npc_papi")
      ? "npc_papi"
      : "npc_meme";
  const sprite = scene.add.sprite(x, y, textureKey);
  sprite.setOrigin(0.5, 1);
  // Certains décors d'object layer sont en "overPlayer" (depth=100000).
  // On force ce PNJ au-dessus pour éviter qu'il passe derrière l'entrée du donjon.
  sprite.setDepth(100001);

  const npcInstance = {
    def: {
      id: "donjon_aluineeks_keeper",
      name: "Gardien",
      mapId: scene.currentMapKey || "MapAndemia3",
      tileX: npcTile.x,
      tileY: npcTile.y,
      textureKey,
      type: "dungeon_keeper",
    },
    sprite,
    tileX: npcTile.x,
    tileY: npcTile.y,
    id: "donjon_aluineeks_keeper",
    type: "dungeon_keeper",
    hoverHighlight: null,
    questMarker: null,
  };

  sprite.setInteractive({ useHandCursor: true });

  sprite.on("pointerover", () => {
    if (npcInstance.hoverHighlight || !scene.add) return;
    const overlay = scene.add.sprite(sprite.x, sprite.y, textureKey);
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
    if (event?.stopPropagation) event.stopPropagation();
    if (!scene.player) return;
    startNpcInteraction(scene, scene.player, npcInstance);
  });

  scene.npcs.push(npcInstance);
  refreshQuestMarkerForNpc(scene, scene.player, npcInstance);
  blockTile(scene, npcTile.x, npcTile.y);
}
