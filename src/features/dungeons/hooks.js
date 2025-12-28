import { createCalibratedWorldToTile } from "../../features/maps/world/util.js";
import { setupCamera } from "../../features/maps/camera.js";
import { maps } from "../../features/maps/index.js";

export function onAfterMapLoaded(scene) {
  if (!scene || !scene.map || !scene.groundLayer) return;

  // Entrance NPC handled by map-placed guard (MapAndemiaNouvelleVersion9).

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
    const fallbackReturnTile =
      maps?.MapAndemiaNouvelleVersion9?.dungeonReturnTile ||
      maps?.MapAndemiaNouvelleVersion9?.entranceNpcTile ||
      { x: 0, y: 0 };
    scene.dungeonState = {
      active: true,
      dungeonId: scene.currentMapDef.dungeonId || "aluineeks",
      roomIndex: Math.max(0, Number(roomIndexRaw) - 1),
      returnMapKey: scene._lastNonDungeonMapKey || "MapAndemiaNouvelleVersion9",
      // Si on charge une salle de donjon directement (reco/dev), on force une tuile de retour fixe
      // pour éviter un retour "hors champ" en sortie.
      returnTile: scene._lastNonDungeonTile || fallbackReturnTile,
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

  if (
    scene.currentMapDef &&
    scene.currentMapDef.key === "MapAndemiaNouvelleVersion9" &&
    scene.player
  ) {
    const px = scene.player.currentTileX;
    const py = scene.player.currentTileY;
    const returnTile = scene.currentMapDef.dungeonReturnTile;
    const isZeroZero = px === 0 && py === 0;
    if (
      isZeroZero &&
      returnTile &&
      typeof returnTile.x === "number" &&
      typeof returnTile.y === "number"
    ) {
      const wp = scene.map.tileToWorldXY(
        returnTile.x,
        returnTile.y,
        undefined,
        undefined,
        scene.groundLayer
      );
      if (wp) {
        const nx = wp.x + scene.map.tileWidth / 2;
        const ny = wp.y + scene.map.tileHeight / 2;
        scene.player.x = nx;
        scene.player.y = ny;
        scene.player.currentTileX = returnTile.x;
        scene.player.currentTileY = returnTile.y;
        if (typeof scene.player.setDepth === "function") {
          scene.player.setDepth(ny);
        }
        setupCamera(scene, scene.map, nx, ny, scene.currentMapDef.cameraOffsets);
      }
    }
  }
}
