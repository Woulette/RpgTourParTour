import { createCalibratedWorldToTile } from "../maps/world/util.js";
import { ensureAluineeksDungeonEntranceNpc } from "./entranceNpc.js";

export function onAfterMapLoaded(scene) {
  if (!scene || !scene.map || !scene.groundLayer) return;

  // Entrance NPC (outside the dungeon).
  ensureAluineeksDungeonEntranceNpc(scene);

  // Track last non-dungeon position for safe return, and auto-init dungeonState
  // when a dungeon room is loaded directly (dev convenience).
  if (scene.currentMapDef && !scene.currentMapDef.isDungeon) {
    scene._lastNonDungeonMapKey = scene.currentMapDef.key;
    if (scene.player) {
      scene._lastNonDungeonTile = {
        x: scene.player.currentTileX ?? 0,
        y: scene.player.currentTileY ?? 0,
      };
    }
  } else if (scene.currentMapDef && scene.currentMapDef.isDungeon && !scene.dungeonState) {
    const roomIndexRaw = scene.currentMapDef.dungeonRoomIndex ?? 1;
    scene.dungeonState = {
      active: true,
      dungeonId: scene.currentMapDef.dungeonId || "aluineeks",
      roomIndex: Math.max(0, Number(roomIndexRaw) - 1),
      returnMapKey: scene._lastNonDungeonMapKey || "MapAndemia3",
      returnTile: scene._lastNonDungeonTile || { x: 0, y: 0 },
    };
  }

  // For dungeon rooms, store all tiles from the Tiled object layer "exits" as portal tiles.
  if (scene.currentMapDef && scene.currentMapDef.isDungeon) {
    const layer =
      scene.map.getObjectLayer("exits") || scene.map.getObjectLayer("Exits");
    const objs = layer && Array.isArray(layer.objects) ? layer.objects : [];
    const worldToTile = createCalibratedWorldToTile(scene.map, scene.groundLayer);

    const tiles = [];
    const seen = new Set();
    objs.forEach((obj) => {
      if (!obj || typeof obj.x !== "number" || typeof obj.y !== "number") return;
      const tilePos = worldToTile(obj.x, obj.y - (obj.height || 0) / 2);
      if (!tilePos) return;
      const key = `${tilePos.x},${tilePos.y}`;
      if (seen.has(key)) return;
      seen.add(key);
      tiles.push({ x: tilePos.x, y: tilePos.y });
    });

    scene.dungeonExitTiles = tiles;
  } else {
    scene.dungeonExitTiles = null;
  }
}
