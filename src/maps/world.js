import { maps } from "./index.js";
import { buildMap } from "./loader.js";
import { setupCamera } from "./camera.js";
import { GAME_WIDTH } from "../config/constants.js";


// Index des maps par coordonnees logiques (x, y).
// Cle: "x,y" -> valeur = definition de map.
const mapsByCoord = new Map();

Object.values(maps).forEach((mapDef) => {
  const pos = mapDef.worldPos;
  if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") return;
  const key = `${pos.x},${pos.y}`;
  if (!mapsByCoord.has(key)) {
    mapsByCoord.set(key, mapDef);
  }
});

export function getMapAt(x, y) {
  return mapsByCoord.get(`${x},${y}`) || null;
}

export function getNeighbor(mapDef, direction) {
  if (!mapDef || !mapDef.worldPos) return null;

  const { x, y } = mapDef.worldPos;
  let nx = x;
  let ny = y;

  switch (direction) {
    case "right":
      nx = x + 1;
      break;
    case "left":
      nx = x - 1;
      break;
    case "up":
      ny = y - 1;
      break;
    case "down":
      ny = y + 1;
      break;
    default:
      return null;
  }

  return getMapAt(nx, ny);
}

// Calcule la zone "jouable" : colonnes/lignes qui ont vraiment des tuiles.
function computePlayableBounds(map, groundLayer) {
  let minX = map.width - 1;
  let maxX = 0;
  let minY = map.height - 1;
  let maxY = 0;
  let found = false;

  const leftByRow = new Array(map.height).fill(null);
  const rightByRow = new Array(map.height).fill(null);

  map.forEachTile(
    (tile) => {
      // Pas de tuile => index = -1 dans Phaser.
      if (tile.index === -1) return;
      found = true;
      const x = tile.x;
      const y = tile.y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (leftByRow[y] === null || x < leftByRow[y]) {
        leftByRow[y] = x;
      }
      if (rightByRow[y] === null || x > rightByRow[y]) {
        rightByRow[y] = x;
      }
    },
    undefined,
    0,
    0,
    map.width,
    map.height,
    groundLayer
  );

  if (!found) return null;
  return { minX, maxX, minY, maxY, leftByRow, rightByRow };
}// Construit
//  les tuiles de sortie pour chaque direction (pour l'instant: droite uniquement).
export function buildWorldExits(map, playableBounds) {
  const exits = {};
  if (!playableBounds) return exits;

  const { rightByRow, maxX } = playableBounds;
  const right = [];

  for (let y = 0; y < map.height; y++) {
    let x = maxX;
    if (rightByRow && typeof rightByRow[y] === "number") {
      x = rightByRow[y];
    }
    if (typeof x === "number") {
      right.push({ x, y });
    }
  }

  exits.right = right;
  return exits;
}


// Recharge une map en reproduisant la logique de centrage de main.js.
export function loadMapLikeMain(scene, mapDef) {
  if (!scene || !mapDef) return;

  // On ne detruit pas l'ancienne map ici pour ne pas casser
  // la logique de deplacement existante : on la masque seulement.
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
  // bornes jouables (zone ou il y a vraiment des tuiles)
  scene.playableBounds = computePlayableBounds(map, scene.groundLayer);
    // Réinitialise l'intention de sortie pour cette map
    scene.exitIntentRight = false;
    scene._worldExitRightX = null;
    scene._exitReachedAt = null;
  
    // Tuiles de sortie de map (bord droit, etc.)
    scene.worldExits = buildWorldExits(map, scene.playableBounds);
    scene.pendingExitDirection = null;
    scene.pendingExitTile = null;  

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
}

export function maybeHandleMapTransition(scene) {
  if (!scene || !scene.player || !scene.currentMapDef || !scene.cameras) {
    return;
  }

  const player = scene.player;
  const playerWorldX = player.x;
  if (typeof playerWorldX !== "number") return;

  const mainCam = scene.cameras.main;
  if (!mainCam) return;

  // On calcule une seule fois la position X monde du bord gauche de la bande.
  if (scene._worldExitRightX == null) {
    const bandWidth = 30; // même valeur que dans exits.js
    const screenX = GAME_WIDTH - bandWidth; // bord gauche de la bande
    const worldPoint = mainCam.getWorldPoint(screenX, 0);
    scene._worldExitRightX = worldPoint.x;
    console.log("[EXIT] world exit X =", scene._worldExitRightX);
  }

  // --- 1) Sortie par tuile ciblée (nouvelle logique) ---

  if (scene.exitIntentRight && scene.pendingExitTile) {
    if (
      typeof player.currentTileX === "number" &&
      typeof player.currentTileY === "number" &&
      player.currentTileX === scene.pendingExitTile.x &&
      player.currentTileY === scene.pendingExitTile.y
    ) {
      // Petit délai visuel avant changement
      const DELAY_MS = 600;
      const now =
        scene.time && typeof scene.time.now === "number"
          ? scene.time.now
          : Date.now();

      if (scene._exitReachedAt == null) {
        scene._exitReachedAt = now;
        return;
      }

      if (now - scene._exitReachedAt >= DELAY_MS) {
        const neighbor = getNeighbor(scene.currentMapDef, "right");
        if (!neighbor) {
          scene.exitIntentRight = false;
          scene.pendingExitDirection = null;
          scene.pendingExitTile = null;
          scene._exitReachedAt = null;
          return;
        }

        console.log("[EXIT] tuile de sortie + délai -> changement de map");
        loadMapLikeMain(scene, neighbor);
        scene.exitIntentRight = false;
        scene.pendingExitDirection = null;
        scene.pendingExitTile = null;
        scene._exitReachedAt = null;
        return;
      }

      // délai pas encore écoulé -> on attend
      return;
    } else {
      // On n'est plus sur la tuile de sortie, on réinitialise le timer
      scene._exitReachedAt = null;
    }
  }

  // --- 2) Fallback : ancienne logique barre rouge (si tuile non utilisée) ---

  if (!scene.exitIntentRight) {
    return;
  }

  const thresholdX = scene._worldExitRightX;
  if (playerWorldX < thresholdX) return;

  const neighbor = getNeighbor(scene.currentMapDef, "right");
  if (!neighbor) {
    scene.exitIntentRight = false;
    return;
  }

  console.log("[EXIT] franchi avec intention -> changement de map");
  loadMapLikeMain(scene, neighbor);
  scene.exitIntentRight = false;
  scene.pendingExitDirection = null;
  scene.pendingExitTile = null;
  scene._exitReachedAt = null;
}




