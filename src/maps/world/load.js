import { buildMap } from "../loader.js";
import { setupCamera } from "../camera.js";
import {
  processPendingRespawnsForCurrentMap,
  spawnInitialMonsters,
} from "../../monsters/index.js";
import { spawnNpcsForMap } from "../../npc/spawn.js";
import { spawnTestTrees } from "../../metier/bucheron/trees.js";
import { createMapExits } from "../exits.js";
import { rebuildCollisionGridFromMap } from "./collision.js";
import { spawnObjectLayerTrees, recalcDepths } from "./decor.js";
import { initWorldExitsForScene } from "./exits.js";
import { getNeighbor } from "./util.js";
import { setupWorkstations } from "../../metier/workstations.js";
import { onAfterMapLoaded } from "../../dungeons/hooks.js";
import { isTileBlocked } from "../../collision/collisionGrid.js";

function hasGroundTile(groundLayer, tileX, tileY) {
  if (!groundLayer || typeof groundLayer.getTileAt !== "function") return true;
  const t = groundLayer.getTileAt(tileX, tileY);
  return !!(t && typeof t.index === "number" && t.index >= 0);
}

function findNearestSpawnableTile(scene, map, groundLayer, startX, startY) {
  if (!map || !groundLayer) return { x: startX, y: startY };
  const maxRadius = Math.max(map.width, map.height);

  const isOk = (x, y) => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    if (!hasGroundTile(groundLayer, x, y)) return false;
    if (isTileBlocked(scene, x, y)) return false;
    return true;
  };

  if (isOk(startX, startY)) return { x: startX, y: startY };

  for (let r = 1; r <= maxRadius; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = startX + dx;
        const y = startY + dy;
        if (isOk(x, y)) return { x, y };
      }
    }
  }

  return { x: startX, y: startY };
}

// Apply custom depths for certain named layers (tronc under player, canopy above).
export function applyCustomLayerDepths(scene) {
  if (!scene || !Array.isArray(scene.mapLayers)) return;
  scene.mapLayers.forEach((layer, index) => {
    if (!layer || typeof layer.setDepth !== "function") return;
    const rawName =
      (
        layer.name ||
        (layer.layer && layer.layer.name) ||
        (layer.tilemapLayer && layer.tilemapLayer.layer?.name) ||
        ""
      )
        .toLowerCase()
        .trim();
    if (rawName.includes("tronc")) {
      layer.setDepth(2);
      return;
    }
    if (rawName.includes("canopy") || rawName.includes("feuillage")) {
      layer.setDepth(100000);
      return;
    }
    layer.setDepth(index);
  });
}

// Reload a map, using the same centering logic as main.js.
export function loadMapLikeMain(scene, mapDef, options = {}) {
  if (!scene || !mapDef) return;

  // Reset any pending combat target when changing maps (prevents stale combats from other maps/rooms).
  scene.pendingCombatTarget = null;

  // Cleanup workstations
  if (Array.isArray(scene.workstations)) {
    scene.workstations.forEach((w) => {
      if (w?.hoverHighlight?.destroy) w.hoverHighlight.destroy();
      if (w?.sprite?.destroy) w.sprite.destroy();
    });
  }
  scene.workstations = [];

  // Cleanup map-scoped entities
  if (Array.isArray(scene.monsters)) {
    scene.monsters.forEach((m) => {
      if (m?.hoverHighlight?.destroy) m.hoverHighlight.destroy();
      m.hoverHighlight = null;
      if (m?.roamTween?.stop) m.roamTween.stop();
      if (m?.roamTimer?.remove) m.roamTimer.remove(false);
      if (m?.destroy) m.destroy();
    });
    scene.monsters = [];
  }
  if (Array.isArray(scene.npcs)) {
    scene.npcs.forEach((npc) => {
      if (npc?.hoverHighlight?.destroy) npc.hoverHighlight.destroy();
      npc.hoverHighlight = null;
      if (npc?.sprite?.destroy) npc.sprite.destroy();
    });
    scene.npcs = [];
  }
  if (Array.isArray(scene.bucheronNodes)) {
    scene.bucheronNodes.forEach((node) => {
      if (node?.hoverHighlight?.destroy) node.hoverHighlight.destroy();
      node.hoverHighlight = null;
      if (node?.sprite?.destroy) node.sprite.destroy();
    });
    scene.bucheronNodes = [];
  }
  if (Array.isArray(scene.staticTrees)) {
    scene.staticTrees.forEach((s) => {
      if (s?.destroy) s.destroy();
    });
    scene.staticTrees = [];
  }
  if (Array.isArray(scene.staticDecor)) {
    scene.staticDecor.forEach((s) => {
      if (s?.destroy) s.destroy();
    });
    scene.staticDecor = [];
  }

  // Hide previous layers (keep them alive to not break camera/movement references)
  if (Array.isArray(scene.mapLayers) && scene.mapLayers.length > 0) {
    scene.mapLayers.forEach((layer) => {
      if (layer?.setVisible) layer.setVisible(false);
    });
  } else if (scene.groundLayer?.setVisible) {
    scene.groundLayer.setVisible(false);
  }

  const { map, groundLayer, layers } = buildMap(scene, mapDef);
  const mapLayers = layers && layers.length > 0 ? layers : [groundLayer];
  mapLayers.forEach((layer) => layer.setOrigin(0, 0));
  if (scene.hudCamera?.ignore) {
    mapLayers.forEach((layer) => scene.hudCamera.ignore(layer));
  }

  scene.map = map;
  scene.groundLayer = groundLayer || mapLayers[0];
  scene.mapLayers = mapLayers;
  scene.currentMapKey = mapDef.key;
  scene.currentMapDef = mapDef;

  applyCustomLayerDepths(scene);

  // Collision from object layer + tile shapes
  rebuildCollisionGridFromMap(scene, map, scene.groundLayer);
  spawnObjectLayerTrees(scene, map, "trees", "staticTrees");
  spawnObjectLayerTrees(scene, map, "decor", "staticDecor");
  setupWorkstations(scene, map, scene.groundLayer, mapDef);

  // Compute playable bounds (used for collision), and world exits (if any).
  initWorldExitsForScene(scene);
  if (mapDef.isDungeon) {
    // In dungeons we disable world transitions, but keep playableBounds.
    scene.worldExits = { up: [], down: [], left: [], right: [] };
    scene.exitDirection = null;
    scene.exitTargetTile = null;
  }

  const desiredTile =
    (options?.startTile &&
      typeof options.startTile.x === "number" &&
      typeof options.startTile.y === "number" &&
      options.startTile) ||
    mapDef.startTile ||
    null;

  const fallbackTileX = Math.floor(map.width / 2);
  const fallbackTileY = Math.floor(map.height / 2);

  const startTileX =
    desiredTile && desiredTile.x >= 0 && desiredTile.x < map.width
      ? desiredTile.x
      : fallbackTileX;
  const startTileY =
    desiredTile && desiredTile.y >= 0 && desiredTile.y < map.height
      ? desiredTile.y
      : fallbackTileY;

  // Certains maps ont des zones "vides" (tuiles index=-1) autour des bords.
  // Si on spawn sur une tuile vide (ex: retour de donjon sur {0,0}), on replace
  // sur la tuile jouable la plus proche.
  const safeStart = findNearestSpawnableTile(
    scene,
    map,
    scene.groundLayer,
    startTileX,
    startTileY
  );
  const safeTileX = safeStart.x;
  const safeTileY = safeStart.y;

  const startWorld = map.tileToWorldXY(
    safeTileX,
    safeTileY,
    undefined,
    undefined,
    scene.groundLayer
  );
  const startX = startWorld.x + map.tileWidth / 2;
  const startY = startWorld.y + map.tileHeight / 2;

  if (scene.player) {
    scene.player.x = startX;
    scene.player.y = startY;
    scene.player.currentTileX = safeTileX;
    scene.player.currentTileY = safeTileY;
    if (typeof scene.player.setDepth === "function") {
      scene.player.setDepth(startY);
    }
  }

  recalcDepths(scene);
  setupCamera(scene, map, startX, startY, mapDef.cameraOffsets);

  // Spawn entities for the new map
  if (mapDef.spawnDefaults) {
    spawnInitialMonsters(scene, map, scene.groundLayer, safeTileX, safeTileY, mapDef);
    spawnTestTrees(scene, map, scene.player, mapDef);
  }

  // Respawns dus uniquement pour cette map (scopés par clé de map).
  processPendingRespawnsForCurrentMap(scene);

  spawnNpcsForMap(scene, map, scene.groundLayer, mapDef.key);
  createMapExits(scene);

  // Dungeon hooks: exit tiles, etc.
  onAfterMapLoaded(scene);
}

// If the player reached an exit tile (world), start the transition to the neighbor map.
export function maybeHandleMapExit(scene) {
  if (!scene || !scene.player || !scene.currentMapDef) return;

  const player = scene.player;
  const dir = scene.exitDirection;
  const target = scene.exitTargetTile;

  if (!dir || !target) return;

  if (
    typeof player.currentTileX !== "number" ||
    typeof player.currentTileY !== "number" ||
    player.currentTileX !== target.x ||
    player.currentTileY !== target.y
  ) {
    return;
  }

  const neighbor = getNeighbor(scene.currentMapDef, dir);
  if (!neighbor) {
    scene.exitDirection = null;
    scene.exitTargetTile = null;
    return;
  }

  // Clear intention to avoid multiple triggers.
  scene.exitDirection = null;
  scene.exitTargetTile = null;

  const DELAY_MS = 150;
  const cam = scene.cameras && scene.cameras.main;

  const doChange = () => {
    loadMapLikeMain(scene, neighbor);
  };

  if (scene.time?.delayedCall) {
    scene.time.delayedCall(DELAY_MS, () => {
      if (cam?.fadeOut && cam?.fadeIn) {
        cam.once("camerafadeoutcomplete", () => {
          doChange();
          cam.fadeIn(150, 0, 0, 0);
        });
        cam.fadeOut(150, 0, 0, 0);
      } else {
        doChange();
      }
    });
  } else {
    doChange();
  }
}
