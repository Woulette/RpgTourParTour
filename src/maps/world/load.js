import { buildMap } from "../loader.js";
import { setupCamera } from "../camera.js";
import { spawnInitialMonsters } from "../../monsters/index.js";
import { spawnNpcsForMap } from "../../npc/spawn.js";
import { spawnTestTrees } from "../../metier/bucheron/trees.js";
import { createMapExits } from "../exits.js";
import { rebuildCollisionGridFromMap } from "./collision.js";
import { spawnObjectLayerTrees } from "./decor.js";
import { initWorldExitsForScene } from "./exits.js";
import { getNeighbor } from "./util.js";
import { setupWorkstations } from "../../metier/workstations.js";

// Applique des profondeurs personnalisÈes pour certains calques nommÈs.
// Exemple: calque contenant "tronc" passe sous le joueur, "canopy"/"feuillage" passe au-dessus.
export function applyCustomLayerDepths(scene) {
  if (!scene || !Array.isArray(scene.mapLayers)) return;
  scene.mapLayers.forEach((layer, index) => {
    if (!layer || typeof layer.setDepth !== "function") return;
    const rawName =
      (layer.name ||
        (layer.layer && layer.layer.name) ||
        (layer.tilemapLayer && layer.tilemapLayer.layer?.name) ||
        "").toLowerCase().trim();
    if (rawName.includes("tronc")) {
      layer.setDepth(2);
      return;
    }
    if (rawName.includes("canopy") || rawName.includes("feuillage")) {
      // TrËs haut pour ‡tre au-dessus du joueur (depth = y)
      layer.setDepth(100000);
      return;
    }
    layer.setDepth(index);
  });
}

// Recharge une map en reproduisant la logique de centrage de main.js.
export function loadMapLikeMain(scene, mapDef) {
  if (!scene || !mapDef) return;

  // Cleanup workstations prÈcÈdents
  if (Array.isArray(scene.workstations)) {
    scene.workstations.forEach((w) => {
      if (w?.hoverHighlight?.destroy) w.hoverHighlight.destroy();
      if (w?.sprite?.destroy) w.sprite.destroy();
    });
  }
  scene.workstations = [];

  // On ne detruit pas l'ancienne map ici pour ne pas casser
  // la logique de deplacement existante : on la masque seulement.
  // Cleanup des entites propres à la map pour Èviter de les voir sur la suivante.
  if (Array.isArray(scene.monsters)) {
    scene.monsters.forEach((m) => {
      if (m?.hoverHighlight?.destroy) {
        m.hoverHighlight.destroy();
      }
      m.hoverHighlight = null;
      if (m && m.destroy) m.destroy();
    });
    scene.monsters = [];
  }
  if (Array.isArray(scene.npcs)) {
    scene.npcs.forEach((npc) => {
      if (npc?.hoverHighlight?.destroy) {
        npc.hoverHighlight.destroy();
      }
      npc.hoverHighlight = null;
      if (npc && npc.sprite && npc.sprite.destroy) {
        npc.sprite.destroy();
      }
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

  if (Array.isArray(scene.mapLayers) && scene.mapLayers.length > 0) {
    scene.mapLayers.forEach((layer) => {
      if (layer && layer.setVisible) {
        layer.setVisible(false);
      }
    });
  } else if (scene.groundLayer && scene.groundLayer.setVisible) {
    scene.groundLayer.setVisible(false);
  }

  const { map, groundLayer, layers } = buildMap(scene, mapDef);
  const mapLayers = layers && layers.length > 0 ? layers : [groundLayer];
  mapLayers.forEach((layer) => layer.setOrigin(0, 0));
  if (scene.hudCamera && scene.hudCamera.ignore) {
    mapLayers.forEach((layer) => scene.hudCamera.ignore(layer));
  }

  scene.map = map;
  scene.groundLayer = groundLayer || mapLayers[0];
  scene.mapLayers = mapLayers;
  scene.currentMapKey = mapDef.key;
  scene.currentMapDef = mapDef;

  applyCustomLayerDepths(scene);

  // Collision : applique les rectangles du calque "collisions"
  rebuildCollisionGridFromMap(scene, map, scene.groundLayer);
  spawnObjectLayerTrees(scene, map, "trees", "staticTrees");
  spawnObjectLayerTrees(scene, map, "decor", "staticDecor");
  setupWorkstations(scene, map, scene.groundLayer, mapDef);

  // Bornes jouables (zone o— il y a vraiment des tuiles) et tuiles de sortie.
  initWorldExitsForScene(scene);

  const centerTileX = Math.floor(map.width / 2);
  const centerTileY = Math.floor(map.height / 2);
  const centerWorld = map.tileToWorldXY(
    centerTileX,
    centerTileY,
    undefined,
    undefined,
    groundLayer
  );

  const startX = centerWorld.x + map.tileWidth / 2;
  const startY = centerWorld.y + map.tileHeight / 2;

  if (scene.player) {
    scene.player.x = startX;
    scene.player.y = startY;
    scene.player.currentTileX = centerTileX;
    scene.player.currentTileY = centerTileY;
  }

  setupCamera(scene, map, startX, startY, mapDef.cameraOffsets);

  // Respawn des entites propres à la nouvelle map
  if (mapDef.spawnDefaults) {
    spawnInitialMonsters(
      scene,
      map,
      scene.groundLayer,
      centerTileX,
      centerTileY,
      mapDef
    );
    spawnTestTrees(scene, map, scene.player, mapDef);
    spawnNpcsForMap(scene, map, scene.groundLayer, mapDef.key);
  }
  createMapExits(scene);
}

// VÈrifie si le joueur est sur une tuile de sortie ciblÈe et lance la transition.
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

  // On annule tout de suite l'intention pour Èviter plusieurs dÈclenchements.
  scene.exitDirection = null;
  scene.exitTargetTile = null;

  const DELAY_MS = 150;
  const cam = scene.cameras && scene.cameras.main;

  const doChange = () => {
    loadMapLikeMain(scene, neighbor);
  };

  if (scene.time && scene.time.delayedCall) {
    scene.time.delayedCall(DELAY_MS, () => {
      if (cam && cam.fadeOut && cam.fadeIn) {
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
