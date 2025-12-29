import { setupCamera } from "../camera.js";
import { recalcDepths } from "./decor.js";
import { initWorldExitsForScene } from "./exits.js";
import { createCalibratedWorldToTile, getNeighbor } from "./util.js";
import { maps } from "../index.js";
import { cleanupSceneForMapLoad } from "./load/cleanup.js";
import { applyCustomLayerDepths, buildSceneMap } from "./load/buildMap.js";
import { computeStartPosition } from "./load/startPosition.js";
import { spawnMapEntities } from "./load/postLoad.js";

export { applyCustomLayerDepths } from "./load/buildMap.js";

export function loadMapLikeMain(scene, mapDef, options = {}) {
  if (!scene || !mapDef) return;

  cleanupSceneForMapLoad(scene);

  const { map } = buildSceneMap(scene, mapDef);

  initWorldExitsForScene(scene);
  scene._lastPortalKey = null;
  scene.worldPortals = buildWorldPortals(map, scene.groundLayer, mapDef);
  if (mapDef.isDungeon) {
    scene.worldExits = { up: [], down: [], left: [], right: [] };
    scene.exitDirection = null;
    scene.exitTargetTile = null;
  }

  const { safeTileX, safeTileY, startX, startY } = computeStartPosition(
    scene,
    map,
    mapDef,
    options
  );

  if (scene.player) {
    scene.player.x = startX;
    scene.player.y = startY;
    scene.player.currentTileX = safeTileX;
    scene.player.currentTileY = safeTileY;
    scene.player.currentMapKey = scene.currentMapKey || mapDef.key || null;
    if (typeof scene.player.setDepth === "function") {
      scene.player.setDepth(startY);
    }
  }

  recalcDepths(scene);
  setupCamera(scene, map, startX, startY, mapDef.cameraOffsets);

  const onRiftTeleport = ({ targetMap, targetStartTile, riftId }) => {
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
  };

  spawnMapEntities(scene, map, mapDef, safeTileX, safeTileY, { onRiftTeleport });
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
          const anchorY = (obj.y ?? 0) + h;
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
      console.warn(
        `[portals] Layer "portals" present but no objects found in ${mapDef?.key || "map"}`
      );
    }

    if (portals.length > 0) return portals;
  }

  return Array.isArray(mapDef?.portals) ? mapDef.portals : [];
}

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
    (p) =>
      p &&
      typeof p.tileX === "number" &&
      typeof p.tileY === "number" &&
      p.tileX === px &&
      p.tileY === py
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
