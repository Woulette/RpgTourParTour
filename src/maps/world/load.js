import { buildMap } from "../loader.js";
import { setupCamera } from "../camera.js";
import {
  processPendingRespawnsForCurrentMap,
  spawnInitialMonsters,
} from "../../monsters/index.js";
import { spawnNpcsForMap } from "../../npc/spawn.js";
import { spawnTestTrees } from "../../metier/bucheron/trees.js";
import { spawnTestHerbs } from "../../metier/alchimiste/plants.js";
import { spawnTestWells } from "./wells.js";
import { spawnRifts } from "./rifts.js";
import { clearStoryPortals, spawnStoryPortals } from "./storyPortals.js";
import { createMapExits } from "../exits.js";
import { rebuildCollisionGridFromMap } from "./collision.js";
import { rebuildDebugGrid } from "./debugGrid.js";
import { spawnObjectLayerTrees, recalcDepths } from "./decor.js";
import { initWorldExitsForScene } from "./exits.js";
import { createCalibratedWorldToTile, getNeighbor } from "./util.js";
import { maps } from "../index.js";
import { setupWorkstations } from "../../metier/workstations.js";
import { onAfterMapLoaded } from "../../dungeons/hooks.js";
import { isTileBlocked } from "../../collision/collisionGrid.js";
import { emit as emitStoreEvent } from "../../state/store.js";

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

  const layers = scene.mapLayers.filter((l) => l && typeof l.setDepth === "function");
  const meta = layers.map((layer, index) => {
    const rawName =
      (
        layer.name ||
        (layer.layer && layer.layer.name) ||
        (layer.tilemapLayer && layer.tilemapLayer.layer?.name) ||
        ""
      )
        .toLowerCase()
        .trim();
    return { layer, index, rawName };
  });

  const isCanopyLayerName = (rawName) => {
    if (!rawName) return false;
    if (rawName.includes("canopy")) return true;
    if (rawName.includes("feuillage")) return true;
    // Dans certaines maps, le feuillage est directement sur un "Calque de Tuiles N"
    // (souvent 5 ou 6). On considère N >= 5 comme canopy.
    const m = rawName.match(/calque\s+de\s+tuiles\s*(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n >= 5) return true;
    }
    return false;
  };

  // 1) Depths de base (index) pour le "sol".
  meta.forEach(({ layer, index, rawName }) => {
    if (rawName.includes("tronc")) return;
    if (isCanopyLayerName(rawName)) return;
    layer.setDepth(index);
  });

  // 2) Tronc : doit être au-dessus de tous les calques sol, mais sous le feuillage.
  let maxGroundDepth = 0;
  meta.forEach(({ layer, rawName }) => {
    if (rawName.includes("tronc")) return;
    if (isCanopyLayerName(rawName)) return;
    const d = layer.depth;
    if (typeof d === "number" && d > maxGroundDepth) maxGroundDepth = d;
  });

  // Expose pour les overlays (grille debug, previews combat, etc.).
  scene.maxGroundDepth = maxGroundDepth;

  meta.forEach(({ layer, rawName }) => {
    if (rawName.includes("tronc")) {
      layer.setDepth(maxGroundDepth + 0.5);
    }
  });

  // 3) Feuillage/canopy : toujours au-dessus.
  meta.forEach(({ layer, rawName }) => {
    if (isCanopyLayerName(rawName)) {
      layer.setDepth(100000);
    }
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
  if (Array.isArray(scene.alchimisteNodes)) {
    scene.alchimisteNodes.forEach((node) => {
      if (node?.hoverHighlight?.destroy) node.hoverHighlight.destroy();
      node.hoverHighlight = null;
      if (node?.sprite?.destroy) node.sprite.destroy();
    });
    scene.alchimisteNodes = [];
  }
  if (Array.isArray(scene.wellNodes)) {
    scene.wellNodes.forEach((node) => {
      if (node?.hoverHighlight?.destroy) node.hoverHighlight.destroy();
      node.hoverHighlight = null;
      if (node?.sprite?.destroy) node.sprite.destroy();
    });
    scene.wellNodes = [];
  }
  if (Array.isArray(scene.riftNodes)) {
    scene.riftNodes.forEach((node) => {
      if (node?.hoverHighlight?.destroy) node.hoverHighlight.destroy();
      node.hoverHighlight = null;
      if (node?.sprite?.destroy) node.sprite.destroy();
    });
    scene.riftNodes = [];
  }
  clearStoryPortals(scene);
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
  rebuildDebugGrid(scene, map, scene.groundLayer, mapLayers);

  // Compute playable bounds (used for collision), and world exits (if any).
  initWorldExitsForScene(scene);
  scene._lastPortalKey = null;
  scene.worldPortals = buildWorldPortals(map, scene.groundLayer, mapDef);
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
    (options?.forceExactStartTile &&
      mapDef.dungeonReturnTile &&
      typeof mapDef.dungeonReturnTile.x === "number" &&
      typeof mapDef.dungeonReturnTile.y === "number" &&
      mapDef.dungeonReturnTile) ||
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

  let safeStartTileX = startTileX;
  let safeStartTileY = startTileY;
  if (
    mapDef.key === "MapAndemiaNouvelleVersion9" &&
    safeStartTileX === 0 &&
    safeStartTileY === 0 &&
    mapDef.dungeonReturnTile &&
    typeof mapDef.dungeonReturnTile.x === "number" &&
    typeof mapDef.dungeonReturnTile.y === "number"
  ) {
    safeStartTileX = mapDef.dungeonReturnTile.x;
    safeStartTileY = mapDef.dungeonReturnTile.y;
  }

  // Certains maps ont des zones "vides" (tuiles index=-1) autour des bords.
  // Si on spawn sur une tuile vide (ex: retour de donjon sur {0,0}), on replace
  // sur la tuile jouable la plus proche.
  const safeStart = options?.forceExactStartTile
    ? { x: safeStartTileX, y: safeStartTileY }
    : findNearestSpawnableTile(
        scene,
        map,
        scene.groundLayer,
        safeStartTileX,
        safeStartTileY
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
    spawnTestHerbs(scene, map, scene.player, mapDef);
    spawnTestWells(scene, map, scene.player, mapDef);
    spawnRifts(scene, map, scene.player, mapDef, {
      onTeleport: ({ targetMap, targetStartTile, riftId }) => {
        if (!targetMap) return;
        if (scene.player) {
          scene.player.activeRiftId = riftId || null;
          scene.player.riftReturnMapKey = scene.currentMapKey || null;
          scene.player.riftReturnTile = {
            x: scene.player.currentTileX,
            y: scene.player.currentTileY,
          };
        }
        const startTile =
          targetStartTile &&
          typeof targetStartTile.x === "number" &&
          typeof targetStartTile.y === "number"
            ? targetStartTile
            : null;
        const cam = scene.cameras && scene.cameras.main;
        const doChange = () =>
          loadMapLikeMain(scene, targetMap, startTile ? { startTile } : undefined);
        if (scene.time?.delayedCall) {
          scene.time.delayedCall(50, () => {
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
      },
    });
  }
  spawnStoryPortals(scene, map, scene.player, mapDef);

  // Respawns dus uniquement pour cette map (scopés par clé de map).
  processPendingRespawnsForCurrentMap(scene);

  spawnNpcsForMap(scene, map, scene.groundLayer, mapDef.key);
  createMapExits(scene);

  // Dungeon hooks: exit tiles, etc.
  onAfterMapLoaded(scene);

  emitStoreEvent("map:changed", {
    mapKey: mapDef.key,
    startTile: { x: safeTileX, y: safeTileY },
  });
}

function getObjProp(obj, name) {
  if (!obj || !obj.properties) return undefined;
  if (Array.isArray(obj.properties)) {
    const p = obj.properties.find((prop) => prop.name === name);
    return p ? p.value : undefined;
  }
  return obj.properties[name];
}

function buildWorldPortals(map, groundLayer, mapDef) {
  const worldToTile =
    map && groundLayer ? createCalibratedWorldToTile(map, groundLayer) : null;

  const portalsLayer =
    map?.getObjectLayer?.("portals") || map?.getObjectLayer?.("Portals") || null;

  // Priorité au calque Tiled "portals" (100% éditable sans toucher le code).
  // Fallback: on scanne tous les object layers si on trouve des objets avec `targetMapKey`.
  const objectLayers = Array.isArray(map?.objects) ? map.objects : null;
  const layersToScan = [];
  if (portalsLayer) layersToScan.push(portalsLayer);
  if (objectLayers) {
    objectLayers.forEach((l) => {
      if (!l || !Array.isArray(l.objects)) return;
      if (portalsLayer && l === portalsLayer) return;
      layersToScan.push(l);
    });
  }

  if (layersToScan.length > 0 && worldToTile) {
    const portals = [];

    layersToScan.forEach((layer) => {
      (layer.objects || []).forEach((obj) => {
        if (!obj) return;

        const targetMapKey =
          getObjProp(obj, "targetMapKey") || getObjProp(obj, "mapKey") || null;
        // On ne considère l'objet comme "portail" que s'il a une destination.
        if (!targetMapKey) return;

        const txProp = getObjProp(obj, "tileX");
        const tyProp = getObjProp(obj, "tileY");

        let tileX;
        let tileY;

        if (typeof txProp === "number" && typeof tyProp === "number") {
          tileX = txProp;
          tileY = tyProp;
        } else {
          const w = typeof obj.width === "number" ? obj.width : map.tileWidth;
          const h = typeof obj.height === "number" ? obj.height : map.tileHeight;
          const anchorX = (obj.x ?? 0) + w / 2;
          const anchorY = (obj.y ?? 0) + h; // bas de l'objet
          const t = worldToTile(anchorX, anchorY);
          if (!t) return;
          tileX = t.x;
          tileY = t.y;
        }

        const targetTileX =
          typeof getObjProp(obj, "targetTileX") === "number"
            ? getObjProp(obj, "targetTileX")
            : null;
        const targetTileY =
          typeof getObjProp(obj, "targetTileY") === "number"
            ? getObjProp(obj, "targetTileY")
            : null;

        portals.push({
          id: getObjProp(obj, "id") || obj.name || obj.type || null,
          tileX,
          tileY,
          targetMapKey,
          targetStartTile:
            typeof targetTileX === "number" && typeof targetTileY === "number"
              ? { x: targetTileX, y: targetTileY }
              : null,
        });
      });
    });

    if (portalsLayer && Array.isArray(portalsLayer.objects) && portalsLayer.objects.length === 0) {
      // Aide debug: si le calque existe mais est vide, c'est souvent que la map n'a pas été exportée.
      console.warn(
        `[portals] Calque \"portals\" présent mais aucun objet trouvé dans ${mapDef?.key || "map"} (as-tu bien exporté la map ?)`
      );
    }

    if (portals.length > 0) return portals;
  }

  // Fallback: portails codés dans src/maps/index.js (moins pratique, mais garde compat).
  return Array.isArray(mapDef?.portals) ? mapDef.portals : [];
}

// Portails "au sol" : si le joueur est sur la tuile, on téléporte vers une map cible.
// Définition via Tiled : calque objet "portals" avec props tileX/tileY + targetMapKey + targetTileX/targetTileY.
export function maybeHandlePortal(scene) {
  if (!scene || !scene.player || !scene.currentMapDef) return;
  if (scene.combatState?.enCours || scene.prepState?.actif) return;

  const portals = Array.isArray(scene.worldPortals)
    ? scene.worldPortals
    : buildWorldPortals(scene.map, scene.groundLayer, scene.currentMapDef);
  if (portals.length === 0) return;

  const px = scene.player.currentTileX;
  const py = scene.player.currentTileY;
  if (typeof px !== "number" || typeof py !== "number") return;

  const hit = portals.find(
    (p) => p && typeof p.tileX === "number" && typeof p.tileY === "number" && p.tileX === px && p.tileY === py
  );

  const key = hit ? `${hit.tileX},${hit.tileY}` : null;
  if (!key) {
    scene._lastPortalKey = null;
    return;
  }

  if (scene._lastPortalKey === key) return;
  scene._lastPortalKey = key;

  const targetKey = hit.targetMapKey;
  if (!targetKey) return;

  const target =
    maps[targetKey] ||
    maps[String(targetKey).trim()] ||
    maps[Object.keys(maps).find((k) => k.toLowerCase() === String(targetKey).toLowerCase())] ||
    null;
  if (!target) return;

  const startTile =
    hit.targetStartTile &&
    typeof hit.targetStartTile.x === "number" &&
    typeof hit.targetStartTile.y === "number"
      ? hit.targetStartTile
      : null;

  const cam = scene.cameras && scene.cameras.main;
  const doChange = () => loadMapLikeMain(scene, target, startTile ? { startTile } : undefined);

  // Même fondu que les sorties de map pour garder un effet "entrée".
  const DELAY_MS = 50;
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
